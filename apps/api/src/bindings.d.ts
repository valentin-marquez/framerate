import type { User } from "@supabase/supabase-js";

export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  /** Service role key — sólo usado por flujos acotados como insert de tickets anónimos. */
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Cloudflare Turnstile secret para validar tokens del widget en server. Opcional en dev. */
  TURNSTILE_SECRET_KEY?: string;
  /** Webhook de Discord donde se notifican nuevos tickets de soporte. Opcional en dev. */
  DISCORD_SUPPORT_WEBHOOK_URL?: string;
  /** User ID en Discord al que mencionar en los embeds de soporte. */
  DISCORD_SUPPORT_PING_USER_ID?: string;
  STRICT_RATE_LIMITER: RateLimit;
  MODERATE_RATE_LIMITER: RateLimit;
  LENIENT_RATE_LIMITER: RateLimit;
  SEARCH_RATE_LIMITER: RateLimit;
};

/**
 * Roles globales emitidos por public.custom_access_token_hook como claims del JWT.
 * Ver packages/db/supabase/migrations/20260514221706_add_user_roles_foundation.sql
 */
export type UserRole = "user" | "moderator" | "admin";

export type Variables = {
  user: User;
  token: string;
  /** Rol más alto del usuario (default "user" si no tiene claim). */
  userRole: UserRole;
  /** Array con todos los roles globales del usuario. */
  userRoles: UserRole[];
  /** Fase 1: store_id resuelto por requireStoreRoleBySlug. */
  storeId?: string;
};
