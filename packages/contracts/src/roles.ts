/** Jerarquía estricta: cada rol incluye los permisos de los anteriores. */
export const ROLES = ["user", "support", "moderator", "admin"] as const;
export type Role = (typeof ROLES)[number];

const ROLE_RANK: Record<Role, number> = { user: 1, support: 2, moderator: 3, admin: 4 };

export const roleRank = (role: Role): number => ROLE_RANK[role];

/** ¿`actual` tiene al menos el rol `required`? */
export const hasRole = (actual: Role, required: Role): boolean => ROLE_RANK[actual] >= ROLE_RANK[required];
