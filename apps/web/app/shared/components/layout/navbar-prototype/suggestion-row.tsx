// PROTOTIPO (#108): una fila de sugerencia; cada variante decide dónde y cómo se agrupan.
import { fold } from "@framerate/kit";
import { IconArrowUpRight, IconClock, IconSearch } from "@tabler/icons-react";
import { getCategoryImage } from "~/features/category/utils/categories";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import type { NavSearch, Suggestion } from "./use-nav-search";

/** Resalta lo que completa el sistema, no lo que ya escribió la persona (Baymard). */
export function Completion({ text, typed }: { text: string; typed: string }) {
  const at = typed ? fold(text).indexOf(fold(typed)) : -1;
  if (at < 0) return <span className="font-semibold text-foreground">{text}</span>;
  return (
    <span className="font-semibold text-foreground">
      {text.slice(0, at)}
      <span className="font-normal text-muted-foreground">{text.slice(at, at + typed.length)}</span>
      {text.slice(at + typed.length)}
    </span>
  );
}

export function SuggestionRow({
  search,
  item,
  index,
  dense,
}: {
  search: NavSearch;
  item: Suggestion;
  index: number;
  dense?: boolean;
}) {
  const active = search.active === index;
  const base = cn(
    "flex w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors",
    dense ? "py-1.5" : "py-2.5",
    active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60",
  );
  const props = {
    id: `nav-suggestion-${index}`,
    role: "option" as const,
    "aria-selected": active,
    className: base,
    // mousedown y no click: el blur del campo cerraría el panel antes de que llegue el click.
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault();
      search.go(item);
    },
    onMouseEnter: () => search.setActive(index),
  };

  switch (item.kind) {
    case "recent":
      return (
        <div {...props}>
          <IconClock className="size-4 shrink-0" />
          <span className="truncate text-foreground">{item.label}</span>
        </div>
      );
    case "query":
      return (
        <div {...props}>
          <IconSearch className="size-4 shrink-0" />
          <span className="truncate">
            Buscar <span className="font-semibold text-foreground">“{item.label}”</span>
          </span>
          <kbd className="ml-auto hidden font-mono text-[10px] md:inline">Enter</kbd>
        </div>
      );
    case "scoped":
      return (
        <div {...props}>
          <IconSearch className="size-4 shrink-0 opacity-0" />
          <span className="truncate">
            <span className="text-foreground">{item.label}</span> en{" "}
            <span className="font-semibold text-primary">{item.category.label}</span>
          </span>
        </div>
      );
    case "category":
      return (
        <div {...props}>
          <img src={getCategoryImage(item.category.slug)} alt="" className="size-7 shrink-0 rounded-lg object-cover" />
          <span className="truncate text-foreground">{item.category.label}</span>
          <span className="ml-auto text-xs tabular-nums">{item.category.productCount.toLocaleString("es-CL")}</span>
        </div>
      );
    case "product":
      return (
        <div {...props}>
          {item.product.imageUrl ? (
            <img
              src={item.product.imageUrl}
              alt=""
              className="size-9 shrink-0 rounded-lg bg-white object-contain p-0.5"
            />
          ) : (
            <span className="size-9 shrink-0 rounded-lg bg-secondary" />
          )}
          <span className="min-w-0 flex-1 truncate">
            <Completion text={item.product.name} typed={search.value.trim()} />
          </span>
          <span className="shrink-0 font-medium text-foreground tabular-nums">
            {item.product.bestPrice ? formatCLP(item.product.bestPrice) : "Sin stock"}
          </span>
          <IconArrowUpRight className="size-4 shrink-0" />
        </div>
      );
  }
}

/** Agrupa las filas por tipo con su título, manteniendo el índice global para el teclado. */
export function SuggestionGroups({ search, dense }: { search: NavSearch; dense?: boolean }) {
  const titles: Record<Suggestion["kind"], string> = {
    recent: "Recientes",
    query: "",
    scoped: "",
    category: "Categorías",
    product: "Productos",
  };
  let lastTitle = "";
  return (
    <div role="listbox" id="nav-suggestions" className="flex flex-col gap-0.5">
      {search.items.map((item, i) => {
        const title = titles[item.kind];
        const header = title && title !== lastTitle ? title : "";
        if (title) lastTitle = title;
        return (
          <div key={`${item.kind}-${item.to}`}>
            {header && (
              <p className="px-3 pt-3 pb-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                {header}
              </p>
            )}
            <SuggestionRow search={search} item={item} index={i} dense={dense} />
          </div>
        );
      })}
    </div>
  );
}

/** Props del input que comparten las variantes: combobox ARIA y el hook. */
export function inputProps(search: NavSearch) {
  return {
    value: search.value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => search.setValue(e.target.value),
    onFocus: () => search.setOpen(true),
    onBlur: () => search.setOpen(false),
    onKeyDown: search.onKeyDown,
    type: "search" as const,
    name: "q",
    role: "combobox" as const,
    "aria-expanded": search.open,
    "aria-controls": "nav-suggestions",
    "aria-activedescendant": search.active >= 0 ? `nav-suggestion-${search.active}` : undefined,
    "aria-label": "Buscar productos",
    autoComplete: "off",
    enterKeyHint: "search" as const,
  };
}
