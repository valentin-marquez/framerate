import type { IngestService } from "@framerate/contracts";

/** Bindings del Worker (ver `wrangler.jsonc`). */
export interface Env {
  DB: D1Database;
  /** `apps/ingest` por RPC (service binding): la API le pide "crawlear ahora", no toca la cola. */
  INGEST: Service & IngestService;
  PUBLIC_RATE_LIMITER?: RateLimit;
  /** Dataset `framerate_events` de Analytics Engine (`blob1` = tipo de evento). Ausente en tests. */
  ANALYTICS?: AnalyticsEngineDataset;
  /** Token de servicio para scripts contra `/v1/admin/*` (equivale a rol admin). `wrangler secret put ADMIN_TOKEN`. */
  ADMIN_TOKEN: string;
  /** Tokens de admin adicionales, uno por persona: `nombre:token,nombre:token`. Se revocan sin tocar ADMIN_TOKEN. */
  ADMIN_TOKENS?: string;
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
  /** Dominio público del bucket R2 de assets (fotos de producto; luego avatares). Sin él se sirven las URLs de origen. */
  ASSETS_BASE_URL?: string;
  /** Secreto de Turnstile para tickets de soporte sin cuenta. Sin él, sólo se puede escribir con sesión. */
  TURNSTILE_SECRET_KEY?: string;
  /** Envío de correos (Email Service). Ausente en tests: los correos se omiten. */
  EMAIL?: SendEmail;

  // ─── Proveedores OAuth ─────────────────────────────────────────────────────
  // Un proveedor queda habilitado cuando están sus DOS credenciales (ver features/identity/providers.ts).
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  FACEBOOK_CLIENT_ID?: string;
  FACEBOOK_CLIENT_SECRET?: string;
}
