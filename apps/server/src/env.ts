import type { IngestService } from "@framerate/contracts";

/** Bindings del Worker (ver `wrangler.jsonc`). */
export interface Env {
  DB: D1Database;
  /** `apps/ingest` por RPC (service binding): la API le pide "crawlear ahora", no toca la cola. */
  INGEST: Service & IngestService;
  PUBLIC_RATE_LIMITER?: RateLimit;
  /** Token de servicio para scripts contra `/v1/admin/*` (equivale a rol admin). `wrangler secret put ADMIN_TOKEN`. */
  ADMIN_TOKEN: string;
  /** "production" | "development". */
  ENVIRONMENT?: string;

  // ─── Autenticación (Better Auth) ───────────────────────────────────────────
  /** Firma cookies y cifra tokens OAuth. Mínimo 32 caracteres. `wrangler secret put BETTER_AUTH_SECRET`. */
  BETTER_AUTH_SECRET: string;
  /** URL pública de ESTA API (base de los callbacks OAuth). Ej.: https://api.framerate.cl */
  BETTER_AUTH_URL: string;
  /** Origen del sitio web: único origen con CORS con cookies y con escrituras permitidas. Ej.: https://framerate.cl */
  WEB_ORIGIN: string;
  /** Dominio para compartir la sesión entre subdominios (ej. "framerate.cl"). Omitir en desarrollo local. */
  COOKIE_DOMAIN?: string;
  /** Base pública de los avatares copiados a R2, si existe. */
  ASSETS_BASE_URL?: string;

  // ─── Proveedores OAuth ─────────────────────────────────────────────────────
  // Un proveedor queda habilitado cuando están sus DOS credenciales (ver features/identity/providers.ts).
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  FACEBOOK_CLIENT_ID?: string;
  FACEBOOK_CLIENT_SECRET?: string;
}
