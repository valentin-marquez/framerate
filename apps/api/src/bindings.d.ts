import type { User } from "@supabase/supabase-js";

export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
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
};
