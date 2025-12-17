import { Logger } from "@framerate/utils";
import { WorkersKVStore } from "@hono-rate-limiter/cloudflare";
import type { Context, Next } from "hono";
import type { ClientRateLimitInfo } from "hono-rate-limiter";
import { rateLimiter } from "hono-rate-limiter";
import type { Bindings, Variables } from "@/bindings";

const logger = new Logger("RateLimit");

type AppEnv = { Bindings: Bindings; Variables: Variables };

/**
 * Almacén KV personalizado que corrige el error de expiración en @hono-rate-limiter/cloudflare
 * @see https://github.com/rhinobase/hono-rate-limiter/issues/44
 *
 * Cloudflare KV requiere que los tiempos de expiración sean al menos 60 segundos en el futuro.
 * El WorkersKVStore original no maneja esto correctamente.
 */
class CloudflareKVStore extends WorkersKVStore<AppEnv> {
	/**
	 * Búfer mínimo de expiración requerido por Cloudflare KV.
	 * @see https://developers.cloudflare.com/kv/api/write-key-value-pairs/#expiring-keys
	 */
	private static readonly KV_MIN_EXPIRATION_BUFFER = 60;

	async increment(key: string): Promise<ClientRateLimitInfo> {
		const nowMS = Date.now();
		const record = await this.get(key);
		const defaultResetTime = new Date(nowMS + this.windowMs);

		const existingResetTimeMS =
			record?.resetTime && new Date(record.resetTime).getTime();
		const isActiveWindow = existingResetTimeMS && existingResetTimeMS > nowMS;

		const payload: ClientRateLimitInfo = {
			totalHits: isActiveWindow ? record.totalHits + 1 : 1,
			resetTime:
				isActiveWindow && existingResetTimeMS
					? new Date(existingResetTimeMS)
					: defaultResetTime,
		};

		await this.updateRecord(key, payload);

		return payload;
	}

	async decrement(key: string): Promise<void> {
		const nowMS = Date.now();
		const record = await this.get(key);

		const existingResetTimeMS =
			record?.resetTime && new Date(record.resetTime).getTime();
		const isActiveWindow = existingResetTimeMS && existingResetTimeMS > nowMS;

		// Solo decrementar si está en una ventana activa
		if (isActiveWindow && record) {
			const payload: ClientRateLimitInfo = {
				totalHits: Math.max(0, record.totalHits - 1),
				resetTime: new Date(existingResetTimeMS),
			};

			await this.updateRecord(key, payload);
		}
	}

	/**
	 * Calcula la expiración asegurándose de que cumpla con el requisito mínimo de Cloudflare KV.
	 * La expiración de KV siempre se establece en 60s después de resetTime o nowSeconds.
	 */
	private calculateExpiration(resetTime: Date): number {
		const resetTimeSeconds = Math.floor(resetTime.getTime() / 1000);
		const nowSeconds = Math.floor(Date.now() / 1000);
		return Math.max(
			resetTimeSeconds + CloudflareKVStore.KV_MIN_EXPIRATION_BUFFER,
			nowSeconds + CloudflareKVStore.KV_MIN_EXPIRATION_BUFFER,
		);
	}

	private async updateRecord(
		key: string,
		payload: ClientRateLimitInfo,
	): Promise<void> {
		await this.namespace.put(this.prefixKey(key), JSON.stringify(payload), {
			expiration: this.calculateExpiration(payload.resetTime as Date),
		});
	}
}

/**
 * Crea un middleware de límite de solicitudes utilizando Cloudflare Workers KV.
 * Debe ser llamado dentro de un manejador de solicitudes para acceder a los bindings.
 */
export function createApiRateLimiter() {
	return (c: Context<AppEnv>, next: Next) => {
		// Skip rate limiting in local development
		const url = new URL(c.req.url);
		if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
			return next();
		}

		if (!c.env.RATE_LIMIT_WINDOW_MS || !c.env.RATE_LIMIT_MAX_REQUESTS) {
			throw new Error(
				"Missing required environment variables: RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX_REQUESTS must be configured",
			);
		}

		const windowMs = Number(c.env.RATE_LIMIT_WINDOW_MS);
		const maxRequests = Number(c.env.RATE_LIMIT_MAX_REQUESTS);

		if (Number.isNaN(windowMs) || Number.isNaN(maxRequests)) {
			throw new Error(
				"Invalid environment variables: RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX_REQUESTS must be valid numbers",
			);
		}

		return rateLimiter<AppEnv>({
			windowMs,
			limit: maxRequests,
			standardHeaders: "draft-6",
			keyGenerator: (c) => c.req.header("cf-connecting-ip") ?? "unknown",
			store: new CloudflareKVStore({
				namespace: c.env.RATE_LIMIT_KV as KVNamespace,
			}),
			handler: (c: Context) => {
				const ip = c.req.header("cf-connecting-ip") ?? "unknown";
				logger.warn(`Límite de solicitudes excedido para la IP: ${ip}`);
				return c.json(
					{ error: "Demasiadas solicitudes, por favor inténtelo más tarde." },
					429,
				);
			},
		})(c, next);
	};
}
