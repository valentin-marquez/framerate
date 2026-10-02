import type { Env } from "@/env";
import type { Auth } from "./auth";

/** Accesos a D1 que hace Better Auth (aproximado si hay requests concurrentes en el isolate); sale en `Server-Timing`. */
export const authD1 = { accesses: 0 };

const instances = new WeakMap<Env, Promise<Auth>>();

/**
 * Better Auth pesa ~1,4 MB de fuentes: se carga con la primera petición que lo necesita (sesión o login) y no en
 * cada arranque en frío del Worker. Una instancia por `env`; su inicialización es asíncrona y no conviene repetirla.
 */
export function getAuth(env: Env): Promise<Auth> {
  let auth = instances.get(env);
  if (!auth) {
    auth = import("./auth").then((m) => m.createAuth(env));
    instances.set(env, auth);
  }
  return auth;
}
