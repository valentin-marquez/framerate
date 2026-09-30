import { type Role, roleRank } from "@framerate/contracts";

/**
 * Reglas de sanciones y de quién puede actuar sobre quién. Lógica pura: el
 * tiempo llega por parámetro.
 */

export interface BanWindow {
  expires_at: string | null;
  lifted_at: string | null;
}

/** Activa si no fue levantada y no expiró. `expires_at` null = permanente. */
export function isBanActive(ban: BanWindow, now: string): boolean {
  if (ban.lifted_at !== null) return false;
  return ban.expires_at === null || ban.expires_at > now;
}

/**
 * Un actor sólo puede sancionar a quien tiene MENOS rango que él: un moderador
 * sanciona usuarios, un admin sanciona moderadores y usuarios, nadie sanciona a un par.
 */
export function canSanction(actor: Role, target: Role): boolean {
  return roleRank(actor) > roleRank(target);
}

export type ExpiryCheck = { ok: true } | { ok: false; reason: "past" };

/** Una sanción temporal debe terminar en el futuro. */
export function checkBanExpiry(expiresAt: string | undefined, now: string): ExpiryCheck {
  return expiresAt === undefined || expiresAt > now ? { ok: true } : { ok: false, reason: "past" };
}
