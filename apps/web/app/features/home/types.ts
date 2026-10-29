import type { CategoryItem, ProductSummary, PublicQuote } from "@framerate/contracts";
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
  /** Bajas de precio (lo mismo que `/bajadas`); vacía, la fila no se muestra. */
  drops: ProductSummary[];
  trendingIds: number[];
  /** Las cuatro públicas con más "me gusta"; con menos, la sección no se muestra. */
  quotes: PublicQuote[];
  stores: ClaimableStore[];
}
