export interface ProductPrices {
  /** Precio efectivo/transferencia (el más bajo entre listings activos). */
  cash: number;
  /** Precio tarjeta/normal del mismo listing (medio de pago, NO un descuento). */
  normal: number;
  /**
   * Precio de referencia para descuento REAL: el cash más alto que tuvo la
   * oferta más barata en su propio historial (ventana 90d). `null` cuando no
   * hubo movimiento real de precio → no hay descuento que mostrar.
   */
  reference: number | null;
  /** Alguna tienda lo tiene con stock. Ausente = desconocido (se asume que sí). */
  in_stock?: boolean;
}

// Sólo los campos que la web lee; el objeto trae más y la ficha los recorre todos con Object.entries.
export interface GpuSpecs {
  chipset?: string | null;
  memory_gb?: number | null;
  memory_type?: string | null;
}

export interface CpuSpecs {
  socket?: string | null;
  cores?: { total?: number | null } | null;
  clocks?: { boost_ghz?: number | null } | null;
}

export interface MotherboardSpecs {
  socket?: string | null;
  chipset?: string | null;
  form_factor?: string | null;
}

export interface RamSpecs {
  type?: string | null;
  total_capacity_gb?: number | null;
  speed_mt_s?: number | null;
  cas_latency?: number | null;
}

export interface StorageSpecs {
  capacity_gb?: number | null;
  form_factor?: string | null;
  interface?: string | null;
  rpm?: number | null;
  cache_mb?: number | null;
}

export interface PsuSpecs {
  wattage?: number | null;
  efficiency_rating?: string | null;
  modular?: "Full" | "Semi" | "No" | "Unknown" | null;
}

export interface CaseSpecs {
  form_factor?: string | null;
  side_panel?: string | null;
}

export interface CpuCoolerSpecs {
  type?: "Air" | "AIO" | "Custom Loop" | "Fanless" | null;
  height_mm?: number | null;
  radiator_size_mm?: number | null;
  fan_size_mm?: number | null;
}

export interface CaseFanSpecs {
  size_mm?: number | null;
  rpm?: { max?: number | null } | null;
  rgb?: boolean | null;
}

export type ProductSpecs =
  | GpuSpecs
  | CpuSpecs
  | MotherboardSpecs
  | RamSpecs
  | StorageSpecs
  | PsuSpecs
  | CaseSpecs
  | CpuCoolerSpecs
  | CaseFanSpecs;

export interface Product {
  id: string | null;
  slug: string | null;
  name: string | null;
  mpn: string | null;
  image_url: string | null;
  brand: { name: string; slug: string };
  brand_slug: string | null;
  category: { name: string; slug: string };
  category_slug: string | null;
  specs: ProductSpecs;
  prices: ProductPrices;
  popularity_score: number;
  listings_count: number | null;
  group_id: string | null;
  created_at: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  code: string;
  created_at: string;
}

export interface Listing {
  id: string;
  product_id: string;
  price_cash: number;
  price_normal: number;
  url: string;
  is_active: boolean;
  stock_quantity: number | null;
  last_scraped_at: string | null;
  external_id: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
  store: { name: string; slug: string; icon_url: string | null };
}

export interface ProductDetail extends Product {
  variants: Product[];
  listings: Listing[];
}
