import OpenAI from "openai";
import { Logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

// System prompt compartido para reducir tokens
export const SYSTEM_PROMPT = `Eres un extractor de specs técnicas de hardware. Responde SOLO con JSON válido.
REGLAS:
- Usa tu conocimiento de specs reales de productos cuando el texto no lo mencione
- "Desconocido" o "Desconocida" solo si realmente no puedes inferirlo
- Arrays vacíos [] si no hay datos
- Formatos: velocidades en "X MHz/GHz", tamaños en "X GB/TB/mm", potencia en "XW"`;

class RateLimiter {
	private queue: Array<{
		// biome-ignore lint/suspicious/noExplicitAny: Generic promise
		fn: () => Promise<any>;
		// biome-ignore lint/suspicious/noExplicitAny: Generic promise
		resolve: (value: any) => void;
		// biome-ignore lint/suspicious/noExplicitAny: Generic promise
		reject: (reason?: any) => void;
	}> = [];
	private isProcessing = false;
	private lastRequestTime = 0;
	private minInterval: number;

	constructor(requestsPerMinute: number) {
		this.minInterval = 60000 / requestsPerMinute;
	}

	async schedule<T>(fn: () => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			this.queue.push({ fn, resolve, reject });
			this.processQueue();
		});
	}

	private async processQueue() {
		if (this.isProcessing) return;
		this.isProcessing = true;

		while (this.queue.length > 0) {
			const now = Date.now();
			const timeSinceLast = now - this.lastRequestTime;
			const waitTime = Math.max(0, this.minInterval - timeSinceLast);

			if (waitTime > 0) {
				await new Promise((r) => setTimeout(r, waitTime));
			}

			const task = this.queue.shift();
			if (task) {
				this.lastRequestTime = Date.now();
				try {
					const result = await task.fn();
					task.resolve(result);
				} catch (error) {
					task.reject(error);
				}
			}
		}

		this.isProcessing = false;
	}
}

export abstract class BaseIAExtractor<T> {
	protected openai: OpenAI;
	protected model: string;
	protected logger: Logger;
	private static groqLimiter = new RateLimiter(10); // 10 RPM = 1 request every 6 seconds (safe for 12k TPM)

	constructor() {
		this.logger = new Logger("IAExtractor");
		const mode =
			Bun.env.AI_MODE ||
			(Bun.env.NODE_ENV === "development" ? "groq" : "deepseek");
		const isGroq = mode === "groq";

		const apiKey = isGroq ? Bun.env.GROQ_API_KEY : Bun.env.DEEPSEEK_API_KEY;
		const baseURL = isGroq
			? "https://api.groq.com/openai/v1"
			: "https://api.deepseek.com";

		this.model = isGroq ? "llama-3.3-70b-versatile" : "deepseek-chat";

		if (!apiKey) {
			throw new Error(
				`Missing API Key for ${isGroq ? "Groq" : "DeepSeek"}. Please set ${
					isGroq ? "GROQ_API_KEY" : "DEEPSEEK_API_KEY"
				} in your environment variables.`,
			);
		}

		this.openai = new OpenAI({
			apiKey,
			baseURL,
		});
	}

	protected async callLLM(
		params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
	): Promise<OpenAI.Chat.Completions.ChatCompletion> {
		const isGroq = this.openai.baseURL.includes("groq.com");

		const makeRequest = async () => {
			try {
				return await this.openai.chat.completions.create(params);
			} catch (error: unknown) {
				// biome-ignore lint/suspicious/noExplicitAny: Error handling
				const err = error as any;
				if (err?.status === 429) {
					this.logger.warn("Rate limit hit (429). Retrying after delay...");
					await new Promise((r) => setTimeout(r, 5000));
					return await this.openai.chat.completions.create(params);
				}
				throw error;
			}
		};

		if (isGroq) {
			return BaseIAExtractor.groqLimiter.schedule(makeRequest);
		}

		return makeRequest();
	}

	/**
	 * Implement this method to call the LLM and return the structured specs.
	 * @param text The text to process (e.g. product title, description, raw specs)
	 * @param context Additional context if needed
	 */
	// biome-ignore lint/suspicious/noExplicitAny: Context can be anything
	protected abstract extractWithLLM(text: string, context?: any): Promise<T>;

	/**
	 * Tries to get specs from cache using MPN. If not found, calls extractWithLLM and caches the result.
	 * @param mpn Manufacturer Part Number (used as cache key)
	 * @param text The text to process
	 * @param context Additional context
	 */
	// biome-ignore lint/suspicious/noExplicitAny: Context can be anything
	async extract(mpn: string, text: string, context?: any): Promise<T | null> {
		if (!mpn) {
			// If no MPN, we can't cache reliably, so maybe just return null or process without cache?
			// For now, let's assume MPN is required for this flow.
			this.logger.warn("No MPN provided, skipping AI extraction.");
			return null;
		}

		try {
			// 1. Check cache
			// Casting to any because types are not yet generated for the new table
			// biome-ignore lint/suspicious/noExplicitAny: Types not generated yet
			const { data: cached, error: cacheError } = await (supabase as any)
				.from("cached_specs_extractions")
				.select("specs")
				.eq("mpn", mpn)
				.single();

			if (!cacheError && cached) {
				this.logger.info(`Cache HIT for MPN: ${mpn}`);
				return cached.specs as T;
			}

			// 2. Call LLM
			this.logger.info(
				`Cache MISS for MPN: ${mpn}. Calling LLM (${this.model})...`,
			);
			const startTime = Date.now();
			const specs = await this.extractWithLLM(text, context);
			const duration = Date.now() - startTime;
			this.logger.info(`LLM extraction completed for ${mpn} in ${duration}ms`);

			// 3. Save to cache
			if (specs) {
				// biome-ignore lint/suspicious/noExplicitAny: Types not generated yet
				const { error: insertError } = await (supabase as any)
					.from("cached_specs_extractions")
					.insert({
						mpn,
						specs: specs,
					});

				if (insertError) {
					this.logger.error(
						`Error caching specs for MPN ${mpn}:`,
						insertError.message,
					);
				} else {
					this.logger.info(`Specs cached successfully for MPN: ${mpn}`);
				}
			}

			return specs;
		} catch (error) {
			this.logger.error(
				`Error in extraction process for MPN ${mpn}:`,
				error instanceof Error ? error.message : String(error),
			);
			return null;
		}
	}
}
