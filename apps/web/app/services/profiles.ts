import { api } from "../lib/api";

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileRequest {
  username?: string;
  full_name?: string;
  avatar_url?: string;
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
};
