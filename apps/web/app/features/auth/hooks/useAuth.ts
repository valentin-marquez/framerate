import type { AuthProviders } from "@framerate/contracts";
import { useRouteLoaderData } from "react-router";
import { useAuthStore } from "~/features/auth/store/auth";

export function useAuth() {
  return useAuthStore();
}

export function useUser() {
  return useAuthStore((state) => state.user);
}

export function useProfile() {
  return useAuthStore((state) => state.profile);
}

/** Proveedores de login habilitados en la API (los carga el loader raíz). */
export function useAuthProviders(): AuthProviders["items"] {
  const root = useRouteLoaderData("root") as { providers?: AuthProviders["items"] } | undefined;
  return root?.providers ?? [];
}
