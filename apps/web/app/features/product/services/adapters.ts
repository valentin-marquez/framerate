import {
  type ProductDetail as ApiProductDetail,
  CATEGORY_LABELS,
  CATEGORY_SLUGS,
  type CategoryItem,
  type PricePoint,
  type ProductSummary,
} from "@framerate/contracts";
import type { Category, Listing, Product, ProductDetail } from "~/shared/utils/db-types";
import type { PriceHistoryResponse, QuickSearchResult } from "./products";

/**
 * La API entrega los contratos de `@framerate/contracts`; la UI usa una forma propia (heredada de las filas de
 * Supabase). Este es el único lugar que traduce entre ambas, para no tocar los componentes.
 */

export function slugifyBrand(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toCategory(item: CategoryItem): Category & { product_count: number } {
  return {
    id: item.id,
    name: item.label,
    slug: item.slug,
    code: item.id,
    created_at: "",
    product_count: item.productCount,
  };
}

const upper = (value: unknown) => (typeof value === "string" ? value.toUpperCase() : undefined);

/** Especificaciones que las tarjetas muestran, derivadas de los atributos que la API extrae del título. */
function specsFromAttributes(category: ProductSummary["category"], a: ProductSummary["attributes"]) {
  switch (category) {
    case "gpu":
      return { chipset: upper(a.chipset), memory_gb: a.vram };
    case "ram":
      return { type: upper(a.type), total_capacity_gb: a.capacity, speed_mt_s: a.speed };
    case "ssd":
      return { capacity_gb: a.capacity, interface: upper(a.interface) };
    case "hdd":
      return { capacity_gb: a.capacity, rpm: a.rpm };
    case "psu":
      return { wattage: a.wattage, efficiency_rating: a.efficiency };
    case "motherboard":
      return { chipset: upper(a.chipset), form_factor: upper(a.formFactor) };
    default:
      return {};
  }
}

export function toProduct(p: ProductSummary): Product {
  const cash = p.bestPrice ?? p.lowestPrice ?? 0;
  return {
    id: String(p.id),
    slug: p.slug,
    name: p.name,
    mpn: p.mpn,
    image_url: p.imageUrl,
    brand: p.brand ? { name: p.brand, slug: slugifyBrand(p.brand) } : { name: "", slug: "" },
    brand_slug: p.brand ? slugifyBrand(p.brand) : null,
    category: { name: CATEGORY_LABELS[p.category], slug: categorySlug(p.category) },
    category_slug: categorySlug(p.category),
    specs: specsFromAttributes(p.category, p.attributes) as unknown as Product["specs"],
    prices: { cash, normal: cash, reference: null },
    popularity_score: 0,
    listings_count: p.offerCount,
    group_id: null,
    created_at: null,
  };
}

const categorySlug = (category: ProductSummary["category"]) => CATEGORY_SLUGS[category];

export function toProductDetail(d: ApiProductDetail): ProductDetail {
  const base = toProduct(d);
  const cheapest = d.offers.find((o) => o.inStock) ?? d.offers[0];
  const listings: Listing[] = d.offers.map((o) => ({
    id: String(o.id),
    product_id: String(d.id),
    price_cash: o.priceCash,
    price_normal: o.priceCard,
    url: o.url,
    is_active: true,
    stock_quantity: o.stockQuantity,
    last_scraped_at: o.lastSeenAt,
    external_id: null,
    currency: "CLP",
    created_at: o.lastSeenAt,
    updated_at: o.lastSeenAt,
    store: { name: o.store.name, slug: o.store.slug, icon_url: null },
  }));
  return {
    ...base,
    prices: { ...base.prices, cash: base.prices.cash, normal: cheapest?.priceCard ?? base.prices.cash },
    variants: [],
    listings,
  };
}

export function toQuickResult(p: ProductSummary): QuickSearchResult {
  return {
    id: String(p.id),
    name: p.name,
    slug: p.slug,
    brand_name: p.brand ?? "",
    category_name: CATEGORY_LABELS[p.category],
    current_price: p.bestPrice ?? p.lowestPrice ?? 0,
    image_url: p.imageUrl,
    rank: 0,
  };
}

/** Agrupa los cambios de precio por tienda, como espera el gráfico. */
export function toPriceHistory(points: PricePoint[], days: number): PriceHistoryResponse {
  const byStore = new Map<string, PriceHistoryResponse["series"][number]>();
  for (const p of points) {
    let series = byStore.get(p.store);
    if (!series) {
      series = { store_slug: p.store, store_name: p.storeName, store_logo_url: null, points: [] };
      byStore.set(p.store, series);
    }
    series.points.push({ recorded_at: p.observedAt, price_cash: p.priceCash, price_normal: p.priceCard });
  }
  return { days, series: [...byStore.values()] };
}
