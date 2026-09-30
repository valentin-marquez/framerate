import { unstable_useRoute as useRoute } from "react-router";

// La sesión sale del loader raíz: ya está en el HTML del servidor y en el primer render, y se actualiza sola cuando
// el root revalida (login, logout, editar perfil).
export function useUser() {
  return useRoute("root")?.loaderData?.user ?? null;
}

export function useProfile() {
  return useRoute("root")?.loaderData?.profile ?? null;
}

/** Proveedores de login habilitados en la API (los carga el loader raíz). */
export function useAuthProviders() {
  return useRoute("root")?.loaderData?.providers ?? [];
}
