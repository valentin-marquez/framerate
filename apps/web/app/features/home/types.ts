import type { CategoryWithCount } from "~/features/category/services/categories";
import type { Product } from "~/features/product/services/products";
import type { ClaimableStore } from "~/features/stores/services/stores";

export interface HomeRow {
  key: string;
  title: string;
  href: string;
  products: Product[];
}

export interface HomeData {
  categories: CategoryWithCount[];
  /** `popular` primero y luego una fila por categoría con suficientes productos. */
  rows: HomeRow[];
  trendingIds: string[];
  stores: ClaimableStore[];
}
