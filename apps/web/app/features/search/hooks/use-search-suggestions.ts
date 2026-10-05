import type { CategoryItem, ProductSummary } from "@framerate/contracts";
import { fold } from "@framerate/kit";
import { type KeyboardEvent, useEffect, useState } from "react";
import { useFetcher, useLocation, useNavigate, useSearchParams } from "react-router";
import type { CatalogData } from "~/features/catalog/load-catalog";

const RECENT_KEY = "framerate:recent-searches";
const MAX_RECENT = 4;
const MAX_PRODUCTS = 4;

export type Suggestion =
  | { kind: "recent"; label: string; to: string }
  | { kind: "query"; label: string; to: string }
  | { kind: "scoped"; label: string; category: CategoryItem; to: string }
  | { kind: "category"; category: CategoryItem; to: string }
  | { kind: "product"; product: ProductSummary; to: string };

export const searchUrl = (q: string) => (q ? `/buscar?q=${encodeURIComponent(q)}` : "/buscar");

function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((v) => typeof v === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/**
 * Estado del buscador como combobox: con el campo vacío ofrece recientes y categorías; al escribir, la búsqueda,
 * la misma acotada a la categoría del primer resultado y algunos productos. Enter sin opción activa va a `/buscar`.
 */
export function useSearchSuggestions(categories: CategoryItem[]) {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const urlQuery = pathname === "/buscar" ? (params.get("q") ?? "") : "";

  const [value, setValue] = useState(urlQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);

  // En /buscar el campo muestra la consulta de la URL (y la sigue al ir atrás o adelante).
  useEffect(() => setValue(urlQuery), [urlQuery]);
  useEffect(() => setRecent(readRecent()), []);

  const typed = value.trim();
  const query = useDebounced(typed, 180);
  // Por el loader de /buscar y no directo a la API: la misma consulta que verá la página de resultados.
  // ponytail: trae la página completa del catálogo (24 productos y marcas); un endpoint de sugerencias si pesa.
  const fetcher = useFetcher<CatalogData>({ key: "search-suggestions" });
  const { load } = fetcher;
  useEffect(() => {
    if (query.length >= 2) load(searchUrl(query));
  }, [query, load]);
  const products = query.length >= 2 && fetcher.data?.search === query ? fetcher.data.products : [];

  const items: Suggestion[] = [];
  if (!typed) {
    for (const label of recent) items.push({ kind: "recent", label, to: searchUrl(label) });
    for (const category of categories) items.push({ kind: "category", category, to: `/categoria/${category.slug}` });
  } else {
    items.push({ kind: "query", label: typed, to: searchUrl(typed) });
    const scope = products[0] && categories.find((c) => c.id === products[0].category);
    if (scope)
      items.push({
        kind: "scoped",
        label: typed,
        category: scope,
        to: `/categoria/${scope.slug}?q=${encodeURIComponent(typed)}`,
      });
    const folded = fold(typed);
    for (const category of categories)
      if (fold(category.label).includes(folded))
        items.push({ kind: "category", category, to: `/categoria/${category.slug}` });
    for (const product of products.slice(0, MAX_PRODUCTS))
      items.push({ kind: "product", product, to: `/producto/${product.slug}` });
  }

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const go = (item: Suggestion) => {
    if (item.kind === "query" || item.kind === "recent" || item.kind === "scoped") {
      const next = [item.label, ...recent.filter((r) => r !== item.label)].slice(0, MAX_RECENT);
      setRecent(next);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {}
    }
    close();
    (document.activeElement as HTMLElement | null)?.blur();
    navigate(item.to);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      // -1 es el campo: el recorrido pasa por él, como en un combobox.
      setActive((i) => {
        const next = i + step;
        if (next >= items.length) return -1;
        if (next < -1) return items.length - 1;
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[active] ?? { kind: "query", label: typed, to: searchUrl(typed) });
    } else if (e.key === "Escape") {
      close();
      e.currentTarget.blur();
    }
  };

  return {
    value,
    change: (next: string) => {
      setValue(next);
      setActive(-1);
      setOpen(true);
    },
    open,
    setOpen,
    close,
    items,
    active: active < items.length ? active : -1,
    setActive,
    go,
    onKeyDown,
  };
}

export type SearchSuggestions = ReturnType<typeof useSearchSuggestions>;
