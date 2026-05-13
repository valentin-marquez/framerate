import { appName } from "~/shared/lib/config";

/*
 * NOTA:
 * Todas las variables de entorno en tiempo de ejecución deben provenir de `cloudflare:workers`.
 * `process.env.NODE_ENV` se utiliza solo para compatibilidad en tiempo de compilación
 * (por ejemplo, `pnpm auth:generate`).
 */

export const isDevelopment = process.env.NODE_ENV === "development";
export const isProduction = process.env.NODE_ENV === "production";

export function getClientEnv() {
  return {
    APP_NAME: appName,
  } as const;
}
