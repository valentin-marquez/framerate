import type { Role } from "@framerate/contracts";

/** Sanción vigente de un usuario. */
export interface ActiveBan {
  reason: string | null;
  /** null = permanente. */
  expiresAt: string | null;
}

/**
 * Usuario de la petición. Los datos salen SIEMPRE de nuestra base (no de la
 * cookie de sesión), así un cambio de rol o una sanción aplican de inmediato.
 */
export interface SessionUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: Role;
  ban: ActiveBan | null;
}

/** Quién ejecuta una acción administrativa: una persona con sesión, o el token de servicio (scripts). */
export type Actor = { kind: "user"; user: SessionUser } | { kind: "token" };

/** Id para columnas con FK a `users` (el token de servicio no es un usuario). */
export const actorUserId = (actor: Actor): string | null => (actor.kind === "user" ? actor.user.id : null);

/** Etiqueta legible para auditoría en columnas de texto libre. */
export const actorLabel = (actor: Actor): string => (actor.kind === "user" ? `user:${actor.user.id}` : "admin-token");

/** El token de servicio equivale a un admin. */
export const actorRole = (actor: Actor): Role => (actor.kind === "user" ? actor.user.role : "admin");
