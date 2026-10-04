// PROTOTIPO (#108): lógica del buscador compartida por las variantes A, B y C. Se reescribe al elegir una.
import type { CategoryItem, ProductSummary } from "@framerate/contracts";
import { fold } from "@framerate/kit";
import { type KeyboardEvent, useEffect, useState } from "react";
import { useFetcher, useLocation, useNavigate, useSearchParams } from "react-router";
import type { CatalogData } from "~/features/catalog/load-catalog";

const RECENT_KEY = "framerate:recent-searches";

export type Suggestion =
  | { kind: "recent"; label: string; to: string }
  | { kind: "query"; label: string; to: string }
  | { kind: "scoped"; label: string; category: CategoryItem; to: string }
  | { kind: "category"; category: CategoryItem; to: string }
  | { kind: "product"; product: ProductSummary; to: string };

// Una variante puede montar dos campos (escritorio y teléfono): se enfoca el que está a la vista.
const focus = () =>
  [...document.querySelectorAll<HTMLInputElement>('input[role="combobox"][name="q"]')]
    .find((el) => el.offsetParent !== null)
    ?.focus();
const blur = () => (document.activeElement as HTMLElement | null)?.blur();

const searchUrl = (q: string) => (q ? `/buscar?q=${encodeURIComponent(q)}` : "/buscar");

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export function useNavSearch(categories: CategoryItem[]) {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const urlQuery = pathname === "/buscar" ? (params.get("q") ?? "") : "";

  const [value, setValue] = useState(urlQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => setValue(urlQuery), [urlQuery]);
  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"));
    } catch {}
  }, []);

  const query = useDebounced(value.trim(), 180);
  // Por el loader de /buscar: corre en el servidor de la web, sin depender del CORS de la API.
  const fetcher = useFetcher<CatalogData>({ key: "nav-search" });
  const { load } = fetcher;
  useEffect(() => {
    if (query.length >= 2) load(searchUrl(query));
  }, [query, load]);
  const products = query.length >= 2 ? (fetcher.data?.products ?? []) : [];
  const isFetching = fetcher.state === "loading";

  const typed = value.trim();
  const items: Suggestion[] = [];
  if (!typed) {
    for (const label of recent) items.push({ kind: "recent", label, to: searchUrl(label) });
    for (const category of categories) items.push({ kind: "category", category, to: `/categoria/${category.slug}` });
  } else {
    items.push({ kind: "query", label: typed, to: searchUrl(typed) });
    const top = query.length >= 2 ? products[0]?.category : undefined;
    const scope = top && categories.find((c) => c.id === top);
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
    if (query.length >= 2)
      for (const product of products.slice(0, 4))
        items.push({ kind: "product", product, to: `/producto/${product.slug}` });
  }

  const remember = (label: string) => {
    const next = [label, ...recent.filter((r) => r !== label)].slice(0, 4);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
  };

  const go = (item: Suggestion) => {
    if (item.kind === "query" || item.kind === "recent" || item.kind === "scoped") remember(item.label);
    setOpen(false);
    setActive(-1);
    blur();
    navigate(item.to);
  };

  const submit = () => go({ kind: "query", label: typed, to: searchUrl(typed) });

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      // -1 es el campo: el ciclo pasa por él, como en un combobox.
      setActive((i) => {
        const next = i + step;
        if (next >= items.length) return -1;
        if (next < -1) return items.length - 1;
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[active];
      if (item) go(item);
      else submit();
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
      blur();
    }
  };

  // `/` y Ctrl+K enfocan el campo desde cualquier parte.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return {
    value,
    setValue: (v: string) => {
      setValue(v);
      setActive(-1);
      setOpen(true);
    },
    open,
    setOpen,
    items,
    active: active >= items.length ? -1 : active,
    setActive,
    loading: isFetching,
    hasRecent: recent.length > 0,
    focus,
    blur,
    go,
    submit,
    onKeyDown,
  };
}

export type NavSearch = ReturnType<typeof useNavSearch>;
