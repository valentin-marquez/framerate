import type { Env } from "@/env";

/**
 * Registro de proveedores de login (OAuth). Es la ÚNICA lista de proveedores:
 * la configuración de Better Auth y `GET /v1/auth/providers` (que la web usa para
 * dibujar los botones) salen de aquí.
 *
 * Un proveedor está habilitado cuando sus dos credenciales existen en el entorno.
 * Sin credenciales queda apagado, sin tocar código.
 *
 * ── Agregar un proveedor ────────────────────────────────────────────────────
 *  1. Si es de los que Better Auth trae (github, twitter, twitch, microsoft…):
 *     agregar sus dos variables a `Env` (env.ts) y una entrada en `PROVIDERS`.
 *  2. Crear la app OAuth en el proveedor con el callback
 *     `${BETTER_AUTH_URL}/v1/auth/callback/<id>`.
 *  3. Cargar las credenciales: `wrangler secret put <ID>_CLIENT_ID` y `_CLIENT_SECRET`.
 *  Listo: aparece en `/v1/auth/providers` y ya se puede iniciar sesión con él.
 *
 * Estado: Discord está en uso. Google y Facebook están cableados pero nunca se
 * han probado con credenciales reales. Apple necesita generar un JWT como client
 * secret y se agrega aparte cuando se decida.
 */

type CredentialKey = {
  [K in keyof Env]-?: K extends `${string}_CLIENT_ID` | `${string}_CLIENT_SECRET` ? K : never;
}[keyof Env];

export interface ProviderDefinition {
  /** Id de Better Auth (define la ruta del callback). */
  id: string;
  label: string;
  /** Variables de entorno con [clientId, clientSecret]. */
  credentials: readonly [id: CredentialKey, secret: CredentialKey];
  /** Opciones de Better Auth para este proveedor. */
  options(clientId: string, clientSecret: string): Record<string, unknown>;
}

export const PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: "discord",
    label: "Discord",
    credentials: ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET"],
    options: (clientId, clientSecret) => ({
      clientId,
      clientSecret,
      scope: ["identify", "email"],
      // El handle de Discord es el mejor candidato de username (la API lo normaliza y lo hace único).
      mapProfileToUser: (profile: { username?: string }) => ({ username: profile.username }),
    }),
  },
  {
    id: "google",
    label: "Google",
    credentials: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    options: (clientId, clientSecret) => ({ clientId, clientSecret }),
  },
  {
    id: "facebook",
    label: "Facebook",
    credentials: ["FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"],
    options: (clientId, clientSecret) => ({ clientId, clientSecret }),
  },
];

/** Proveedores con sus dos credenciales presentes (y no vacías) en este entorno. */
export function enabledProviders(env: Partial<Env>): ProviderDefinition[] {
  return PROVIDERS.filter((p) => Boolean(env[p.credentials[0]]) && Boolean(env[p.credentials[1]]));
}

/** Opciones `socialProviders` de Better Auth para los proveedores habilitados. */
export function buildSocialProviders(env: Partial<Env>): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    enabledProviders(env).map((p) => [p.id, p.options(String(env[p.credentials[0]]), String(env[p.credentials[1]]))]),
  );
}
