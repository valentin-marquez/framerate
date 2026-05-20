import { api } from "~/shared/lib/api";

export type MyStoreRole = "owner" | "admin" | "editor";

export interface MyStore {
  id: string;
  slug: string;
  name: string;
  icon_url: string | null;
  role: MyStoreRole | null;
}

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  lang: "es" | "en" | "arn" | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileRequest {
  username?: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string | null;
  lang?: "es" | "en" | "arn";
}

export const profilesService = {
  /**
   * Obtiene el perfil público de un usuario por username.
   */
  getByUsername: (username: string) => api.get<Profile>(`/v1/profiles/${username}`),

  /**
   * Obtiene el perfil del usuario autenticado.
   */
  getMe: (token: string) => api.get<Profile>("/v1/profiles/me", { token }),

  /**
   * Actualiza el perfil del usuario autenticado.
   */
  updateMe: (data: UpdateProfileRequest, token: string) => api.patch<Profile>("/v1/profiles/me", data, { token }),

  /**
   * Sincroniza el avatar del provider OAuth al bucket `user-avatars`.
   * Idempotente: si el avatar ya está en el bucket no hace nada.
   */
  syncAvatar: (token: string) =>
    api.post<{ synced: boolean; profile: Profile; reason?: string }>("/v1/auth/sync-avatar", {}, { token }),

  /**
   * Lista las tiendas donde el usuario autenticado es miembro de la account
   * dueña (owner/admin/editor). Devuelve una lista posiblemente vacía.
   */
  listMyStores: (token: string) => api.get<{ stores: MyStore[] }>("/v1/profiles/me/stores", { token }),
};
