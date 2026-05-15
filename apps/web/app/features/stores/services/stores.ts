import { api } from "~/shared/lib/api";

export interface StoreDetail {
  id: string;
  name: string;
  slug: string;
  url: string;
  website: string | null;
  logo_url: string | null;
  banner_url: string | null;
  description: string | null;
  social: Record<string, string>;
  is_active: boolean;
  appearance: "light" | "dark";
  owner_user_id: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
  rating: { average: number | null; count: number };
}

export interface StoreMember {
  id: string;
  user_id: string;
  role: "owner" | "editor";
  invited_by: string | null;
  created_at: string;
  profiles?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface StoreUpdate {
  description?: string | null;
  website?: string | null;
  social?: Record<string, string>;
  banner_url?: string | null;
}

export const storesService = {
  get: (slug: string) => api.get<StoreDetail>(`/v1/stores/${slug}`),
  update: (slug: string, data: StoreUpdate, token: string) =>
    api.patch<StoreDetail>(`/v1/stores/${slug}`, data, { token }),
  listMembers: (slug: string, token: string) =>
    api.get<{ members: StoreMember[] }>(`/v1/stores/${slug}/members`, { token }),
  addMember: (slug: string, userId: string, role: "owner" | "editor", token: string) =>
    api.post<StoreMember>(`/v1/stores/${slug}/members`, { user_id: userId, role }, { token }),
  removeMember: (slug: string, userId: string, token: string) =>
    api.delete<{ ok: boolean }>(`/v1/stores/${slug}/members/${userId}`, { token }),
};
