import { useAuthStore } from "~/features/auth/store/auth";

/**
 * La sesión real es una cookie que el navegador y el SSR envían solos. Las features que aún usan la firma
 * `(…, token)` reciben este marcador cuando hay sesión; el cliente HTTP lo ignora. Se elimina feature por feature.
 */
export const SESSION_TOKEN = "cookie-session";

export function getSessionToken(): string | undefined {
  return useAuthStore.getState().user ? SESSION_TOKEN : undefined;
}
