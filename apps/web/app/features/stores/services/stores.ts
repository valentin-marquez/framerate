import type { Product } from "~/features/product/services/products";
import { api } from "~/shared/lib/api";

export interface StoreAccount {
  id: string;
  slug: string;
  name: string;
}

export interface StoreDetail {
  id: string;
  /** Nombre mostrado: display_name del dueño ?? nombre canónico. */
  name: string;
  /** Nombre canónico (scraped). Inmutable por el dueño. */
  canonical_name: string;
  /** Override del dueño, o null si no lo ha cambiado. */
  display_name: string | null;
  slug: string;
  url: string;
  website: string | null;
  logo_url: string | null;
  icon_url: string | null;
  banner_url: string | null;
  description: string | null;
  social: Record<string, string>;
  is_active: boolean;
  appearance: "light" | "dark";
  /** La tienda ya tiene account dueña (reclamada). */
  is_claimed: boolean;
  /** Account dueña, o null si no está reclamada. */
  account: StoreAccount | null;
  owner_user_id: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
  /** Stats de rating: general + ventana reciente (últimos 30 días), estilo Steam. */
  rating: {
    average: number | null;
    count: number;
    recent: { average: number | null; count: number };
  };
}

export type StoreMemberRole = "owner" | "admin" | "editor";

export interface StoreMember {
  id: string;
  user_id: string;
  role: StoreMemberRole;
  invited_by: string | null;
  created_at: string;
  profiles?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface StoreUpdate {
  display_name?: string | null;
  description?: string | null;
  website?: string | null;
  social?: Record<string, string>;
}

export interface StoreAssetResult {
  kind: "icon" | "banner";
  path: string;
  url: string;
}

export type ViewerStoreRole = "owner" | "editor" | "admin";

/** Tienda del catálogo tal como la consume el selector de "reclamar tienda". */
export interface ClaimableStore {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  /** Dominio verificable derivado de `stores.url`. null => no reclamable por DNS. */
  domain: string | null;
  is_claimed: boolean;
}

/** Una categoría de productos que la tienda tiene listados. */
export interface StoreProductCategory {
  slug: string;
  name: string;
  /** Total de productos de la tienda en esta categoría. */
  count: number;
  /** Subconjunto destacado (orden: popularidad) para el carrusel. */
  products: Product[];
}

export interface StoreProductsResponse {
  store: { slug: string; name: string };
  /** Total de productos distintos que la tienda tiene listados. */
  total: number;
  categories: StoreProductCategory[];
}

export const storesService = {
  get: (slug: string) => api.get<StoreDetail>(`/v1/stores/${slug}`),
  getProducts: (slug: string) => api.get<StoreProductsResponse>(`/v1/stores/${slug}/products`),
  listClaimable: (q?: string) => api.get<{ stores: ClaimableStore[] }>("/v1/stores", q ? { params: { q } } : undefined),
  getMyRole: (slug: string, token: string) =>
    api.get<{ role: ViewerStoreRole | null }>(`/v1/stores/${slug}/me`, { token }),
  update: (slug: string, data: StoreUpdate, token: string) =>
    api.patch<StoreDetail>(`/v1/stores/${slug}`, data, { token }),
  uploadAsset: (slug: string, kind: "icon" | "banner", file: File, token: string) => {
    const form = new FormData();
    form.set("kind", kind);
    form.set("file", file);
    return api.upload<StoreAssetResult>(`/v1/stores/${slug}/assets`, form, { token });
  },
  listMembers: (slug: string, token: string) =>
    api.get<{ members: StoreMember[] }>(`/v1/stores/${slug}/members`, { token }),
  addMember: (slug: string, userId: string, role: StoreMemberRole, token: string) =>
    api.post<StoreMember>(`/v1/stores/${slug}/members`, { user_id: userId, role }, { token }),
  removeMember: (slug: string, userId: string, token: string) =>
    api.delete<{ ok: boolean }>(`/v1/stores/${slug}/members/${userId}`, { token }),
};
