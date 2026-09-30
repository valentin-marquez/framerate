import { z } from "zod";

/**
 * Contratos de identidad: perfil, roles, proveedores de login y sanciones.
 * Los comparten la API (que valida) y la web (que tipa lo que recibe).
 */

// ─── Roles ───────────────────────────────────────────────────────────────────

/** Jerarquía estricta: cada rol incluye los permisos de los anteriores. */
export const ROLES = ["user", "moderator", "admin"] as const;
export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;

const ROLE_RANK: Record<Role, number> = { user: 1, moderator: 2, admin: 3 };

export const roleRank = (role: Role): number => ROLE_RANK[role];

/** ¿`actual` tiene al menos el rol `required`? */
export const hasRole = (actual: Role, required: Role): boolean => ROLE_RANK[actual] >= ROLE_RANK[required];

// ─── Perfil ──────────────────────────────────────────────────────────────────

/** Handle público (`/u/:username`): 3–24 caracteres, minúsculas, dígitos y `_`. Igual que el CHECK de la base. */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;
export const UsernameSchema = z
  .string()
  .regex(USERNAME_PATTERN, "Usa 3 a 24 caracteres: minúsculas, números y guion bajo");

/** Handles que no puede tomar nadie: rutas del sitio y nombres que suplantan al sistema. */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "admin",
  "administrador",
  "administrator",
  "api",
  "app",
  "auth",
  "bot",
  "categoria",
  "cotizacion",
  "explorar",
  "framerate",
  "help",
  "ayuda",
  "login",
  "logout",
  "moderador",
  "moderator",
  "mod",
  "null",
  "undefined",
  "privacy",
  "producto",
  "profile",
  "reclamar",
  "root",
  "settings",
  "soporte",
  "support",
  "sistema",
  "system",
  "terms",
  "tiendas",
  "user",
  "usuario",
]);

export const LangSchema = z.enum(["es", "en", "arn"]);
export type Lang = z.infer<typeof LangSchema>;

export const ThemeSchema = z.enum(["system", "light", "dark"]);
export type Theme = z.infer<typeof ThemeSchema>;

export const DisplayNameSchema = z.string().trim().min(1, "Escribe un nombre").max(60);
export const BioSchema = z.string().trim().max(280);

export const BanSchema = z.object({
  reason: z.string().nullable(),
  /** null = permanente. */
  expiresAt: z.iso.datetime().nullable(),
});
export type Ban = z.infer<typeof BanSchema>;

/** Perfil propio (`GET /v1/me`): incluye datos privados. */
export const MeSchema = z.object({
  id: z.string(),
  email: z.email(),
  username: UsernameSchema,
  displayName: z.string(),
  avatarUrl: z.url().nullable(),
  bio: z.string().nullable(),
  lang: LangSchema,
  theme: ThemeSchema,
  role: RoleSchema,
  createdAt: z.iso.datetime(),
  /** Sanción vigente, si la hay (bloquea publicar, no iniciar sesión ni editar el perfil). */
  ban: BanSchema.nullable(),
});
export type Me = z.infer<typeof MeSchema>;

/** Perfil público (`GET /v1/users/:username`): sin email, rol ni sanciones. */
export const PublicProfileSchema = z.object({
  username: UsernameSchema,
  displayName: z.string(),
  avatarUrl: z.url().nullable(),
  bio: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type PublicProfile = z.infer<typeof PublicProfileSchema>;

/**
 * Cambios que el usuario puede hacer a su propio perfil. Deliberadamente NO
 * incluye avatar, email ni rol: el avatar viene del proveedor y el rol lo
 * cambia sólo un admin.
 */
export const UpdateProfileSchema = z
  .object({
    displayName: DisplayNameSchema,
    username: UsernameSchema,
    /** Vacío o null borra la biografía. */
    bio: BioSchema.nullable().transform((v) => (v === "" ? null : v)),
    lang: LangSchema,
    theme: ThemeSchema,
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "No hay nada que actualizar");
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

// ─── Proveedores de login ────────────────────────────────────────────────────

/** Proveedores habilitados en este despliegue (los que tienen credenciales). La web dibuja sus botones con esto. */
export const AuthProvidersSchema = z.object({
  items: z.array(z.object({ id: z.string(), label: z.string() })),
});
export type AuthProviders = z.infer<typeof AuthProvidersSchema>;

/** `GET /v1/auth/list-accounts` (Better Auth): cuentas de proveedor del usuario, sin tokens. */
export const LinkedAccountsSchema = z.array(
  z.object({
    /** Id de la fila: es el `accountId` que pide `POST /v1/auth/unlink-account`. */
    id: z.string(),
    providerId: z.string(),
    /** Id del usuario en el proveedor (no sirve para desvincular). */
    accountId: z.string(),
    userId: z.string(),
    scopes: z.array(z.string()),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
);
export type LinkedAccounts = z.infer<typeof LinkedAccountsSchema>;

// ─── Administración de usuarios ──────────────────────────────────────────────

export const AdminUserSchema = z.object({
  id: z.string(),
  username: UsernameSchema,
  displayName: z.string(),
  role: RoleSchema,
  createdAt: z.iso.datetime(),
  ban: BanSchema.nullable(),
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const BanRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  /** Omitido = permanente. Debe ser futuro. */
  expiresAt: z.iso.datetime().optional(),
});
export type BanRequest = z.infer<typeof BanRequestSchema>;

export const ChangeRoleRequestSchema = z.object({ role: RoleSchema });
export type ChangeRoleRequest = z.infer<typeof ChangeRoleRequestSchema>;
