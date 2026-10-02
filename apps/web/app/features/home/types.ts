import type { CategoryItem, ProductSummary } from "@framerate/contracts";
import type { ClaimableStore } from "~/features/stores/services/stores";

export interface HomeRow {
  key: string;
  title: string;
  href: string;
  products: ProductSummary[];
}

export interface HomeData {
  categories: CategoryItem[];
  /** `popular` primero y luego una fila por categoría con suficientes productos. */
  rows: HomeRow[];
  trendingIds: number[];
  stores: ClaimableStore[];
}
