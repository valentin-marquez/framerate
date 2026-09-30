import type { Me, PublicProfile } from "@framerate/contracts";
import { api } from "~/shared/lib/api";

export type MyStoreRole = "owner" | "admin" | "editor";

export interface MyStore {
  id: string;
  slug: string;
  name: string;
  icon_url: string | null;
  role: MyStoreRole | null;
}

/** Forma de perfil que usa la UI. Se arma desde los contratos de la API (`Me` / `PublicProfile`). */
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
  bio?: string | null;
  lang?: "es" | "en" | "arn";
}

export function meToProfile(me: Me): Profile {
  return {
    id: me.id,
    username: me.username,
    full_name: me.displayName,
    avatar_url: me.avatarUrl,
    bio: me.bio,
    lang: me.lang,
    created_at: me.createdAt,
    updated_at: me.createdAt,
  };
}

export function publicToProfile(profile: PublicProfile): Profile {
  return {
    id: profile.username,
    username: profile.username,
    full_name: profile.displayName,
    avatar_url: profile.avatarUrl,
    bio: profile.bio,
    lang: null,
    created_at: profile.createdAt,
    updated_at: profile.createdAt,
  };
}

export const profilesService = {
  getByUsername: async (username: string) => publicToProfile(await api.get<PublicProfile>(`/v1/users/${username}`)),

  getMe: async () => meToProfile(await api.get<Me>("/v1/me")),

  updateMe: async (data: UpdateProfileRequest) =>
    meToProfile(
      await api.patch<Me>("/v1/me", {
        displayName: data.full_name,
        username: data.username,
        bio: data.bio,
        lang: data.lang,
      }),
    ),

  // Pendiente: las tiendas y sus miembros aún no existen en la API nueva.
  listMyStores: async (): Promise<{ stores: MyStore[] }> => ({ stores: [] }),
};
