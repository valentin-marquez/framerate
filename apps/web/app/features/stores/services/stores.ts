import {
  type StoreDetail as ApiStoreDetail,
  type StoreMember as ApiStoreMember,
  CATEGORY_LABELS,
  CATEGORY_SLUGS,
  type StoreListItem,
  type StoreProducts,
  type UpdateStoreRequest,
} from "@framerate/contracts";
import { toProduct } from "~/features/product/services/adapters";
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

export type StoreMember = ApiStoreMember;

export interface StoreUpdate {
  display_name?: string | null;
  description?: string | null;
  website?: string | null;
  social?: Record<string, string>;
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

function toStoreDetail(s: ApiStoreDetail): StoreDetail {
  return {
    id: s.slug,
    slug: s.slug,
    name: s.name,
    canonical_name: s.canonicalName,
    display_name: s.displayName,
    url: s.url,
    website: s.website,
    logo_url: s.iconUrl,
    icon_url: s.iconUrl,
    banner_url: s.bannerUrl,
    description: s.description,
    social: s.social as Record<string, string>,
    is_active: s.isActive,
    appearance: "light",
    is_claimed: s.isClaimed,
    account: null,
    owner_user_id: null,
    verified_at: s.verifiedAt,
    created_at: s.createdAt,
    updated_at: s.createdAt,
    member_count: 0,
    rating: s.rating,
  };
}

async function getProducts(slug: string, name: string): Promise<StoreProductsResponse> {
  const res = await api.get<StoreProducts>(`/v1/stores/${slug}/products`);
  return {
    store: { slug, name },
    total: res.total,
    categories: res.categories.map((c) => ({
      slug: CATEGORY_SLUGS[c.category],
      name: CATEGORY_LABELS[c.category],
      count: c.count,
      products: c.items.map(toProduct),
    })),
  };
}

export const storesService = {
  get: async (slug: string) => toStoreDetail(await api.get<ApiStoreDetail>(`/v1/stores/${slug}`)),
  getProducts,
  listClaimable: async (q?: string): Promise<{ stores: ClaimableStore[] }> => {
    const { items } = await api.get<{ items: StoreListItem[] }>("/v1/stores", q ? { params: { q } } : undefined);
    return {
      stores: items.map((s) => ({
        id: s.slug,
        slug: s.slug,
        name: s.name,
        icon_url: s.iconUrl,
        domain: s.domain,
        is_claimed: s.isClaimed,
      })),
    };
  },
  getMyRole: (slug: string, _token?: string) => api.get<{ role: ViewerStoreRole | null }>(`/v1/stores/${slug}/me`),
  update: async (slug: string, data: StoreUpdate, _token?: string) => {
    const body: UpdateStoreRequest = {
      ...(data.display_name !== undefined && { displayName: data.display_name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.website !== undefined && { website: data.website }),
      ...(data.social !== undefined && { social: data.social }),
    };
    await api.patch(`/v1/stores/${slug}`, body);
    return storesService.get(slug);
  },
  listMembers: async (slug: string, _token?: string) => ({
    members: (await api.get<{ items: StoreMember[] }>(`/v1/stores/${slug}/members`)).items,
  }),
  addMember: (slug: string, username: string, role: Exclude<StoreMemberRole, "owner">) =>
    api.post<null>(`/v1/stores/${slug}/members`, { username, role }),
  removeMember: (slug: string, userId: string, _token?: string) =>
    api.delete<null>(`/v1/stores/${slug}/members/${userId}`),
};
