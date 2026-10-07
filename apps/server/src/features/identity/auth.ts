import { createDb } from "@framerate/database";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import type { Env } from "@/env";
import { authD1 } from "./auth-instance";
import { cleanDisplayName, emailLocalPart, generateUsername } from "./domain/username";
import { buildSocialProviders } from "./providers";

/**
 * Configuración de Better Auth (login OAuth y sesiones).
 *
 * Better Auth es dueño de las tablas `users`, `auth_accounts`, `auth_sessions`
 * y `auth_verifications` en cuanto a escritura de sesiones/cuentas; nosotros
 * mapeamos sus campos a nuestras columnas `snake_case`. Lo que NO le dejamos:
 *   - el handle (`username`): lo genera este servidor, nunca se copia del proveedor;
 *   - actualizar el perfil (`/update-user`): dejaría al cliente escribir su avatar;
 *     el perfil se edita con `PATCH /v1/me` (features/identity/identity.routes.ts).
 */

const DAY = 60 * 60 * 24;

export interface CreateAuthOptions {
  /** Plugins extra. Sólo lo usan los tests (`testUtils`); producción no pasa nada. */
  plugins?: BetterAuthOptions["plugins"];
}

function countAccesses(d1: D1Database): D1Database {
  return new Proxy(d1, {
    get(target, prop) {
      const value = Reflect.get(target, prop);
      if (typeof value !== "function") return value;
      const counts = prop === "prepare" || prop === "batch" || prop === "exec";
      return (...args: unknown[]) => {
        if (counts) authD1.accesses++;
        return value.apply(target, args);
      };
    },
  });
}

export function createAuth(env: Env, options: CreateAuthOptions = {}) {
  const db = createDb(env.DB);
  const isUsernameTaken = async (username: string) =>
    (await db.query.selectFrom("users").select("id").where("username", "=", username).executeTakeFirst()) !== undefined;

  return betterAuth({
    appName: "Framerate",
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/v1/auth",
    secret: env.BETTER_AUTH_SECRET,
    // D1 nativo: Better Auth lo detecta por su forma y no usa transacciones (D1 no las tiene).
    database: countAccesses(env.DB),
    trustedOrigins: [env.WEB_ORIGIN],
    telemetry: { enabled: false },
    logger: { level: "warn" },
    // El límite de peticiones lo aplica la API (binding de Workers); el de Better Auth es en memoria por isolate.
    rateLimit: { enabled: false },
    socialProviders: buildSocialProviders(env) as BetterAuthOptions["socialProviders"],

    // Rutas de Better Auth que esta API no expone (ver comentario de cabecera).
    disabledPaths: ["/update-user", "/change-email", "/delete-user", "/delete-user/callback"],

    user: {
      modelName: "users",
      fields: {
        name: "display_name",
        emailVerified: "email_verified",
        // La URL que entrega el proveedor; la copia propia (`avatar_key`) la gestionamos nosotros.
        image: "avatar_source_url",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      additionalFields: {
        // Lo escribe el hook de abajo; el cliente no puede enviarlo (`input: false`).
        username: { type: "string", required: false, input: false },
      },
    },
    session: {
      modelName: "auth_sessions",
      fields: {
        userId: "user_id",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      expiresIn: 30 * DAY,
      updateAge: DAY,
      // Sin esto cada request con sesión lee `auth_sessions` en D1. El rol, la sanción y la baja de cuenta no salen de
      // la caché: `loadSessionUser` los lee siempre. Lo único que tarda hasta 5 min es una sesión borrada en D1.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    account: {
      modelName: "auth_accounts",
      fields: {
        userId: "user_id",
        providerId: "provider_id",
        accountId: "account_id",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        idToken: "id_token",
        accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      // No usamos los tokens del proveedor después del login: si se guardan, van cifrados.
      encryptOAuthTokens: true,
      accountLinking: {
        // Implícita: un correo verificado en el proveedor Y en el usuario existente se vincula a ese usuario.
        enabled: true,
        // Manual (`link-social` con sesión): el usuario prueba ambas identidades en el mismo flujo, así que el
        // correo puede ser otro. No afecta la implícita, que sigue buscando por correo verificado.
        allowDifferentEmails: true,
      },
    },
    verification: {
      modelName: "auth_verifications",
      fields: { expiresAt: "expires_at", createdAt: "created_at", updatedAt: "updated_at" },
    },

    advanced: {
      // Better Auth apaga el control de Origin/callbackURL con NODE_ENV=test; así los tests ven el de producción.
      disableOriginCheck: false,
      cookiePrefix: "framerate",
      // Inspeccionar el esquema son ~70 accesos a D1 que cada isolate nuevo espera antes de la primera sesión (~500 ms).
      // El esquema es de nuestras migraciones, no de Better Auth.
      database: { validateSchema: false, joins: true },
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      crossSubDomainCookies: env.COOKIE_DOMAIN ? { enabled: true, domain: env.COOKIE_DOMAIN } : { enabled: false },
    },

    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const candidate = typeof user.username === "string" ? user.username : emailLocalPart(user.email);
            const username = await generateUsername(candidate || user.name, isUsernameTaken);
            return { data: { ...user, username, name: cleanDisplayName(user.name) || username } };
          },
        },
      },
      session: {
        create: {
          // Una cuenta eliminada no vuelve a iniciar sesión.
          before: async (session) => {
            const row = await db.query
              .selectFrom("users")
              .select("deleted_at")
              .where("id", "=", session.userId)
              .executeTakeFirst();
            if (row?.deleted_at) return false;
          },
        },
      },
    },

    plugins: options.plugins,
  });
}

export type Auth = ReturnType<typeof createAuth>;
