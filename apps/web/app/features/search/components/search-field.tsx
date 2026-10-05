import type { CategoryItem } from "@framerate/contracts";
import { fold } from "@framerate/kit";
import { IconArrowUpRight, IconClock, IconLoader2, IconSearch } from "@tabler/icons-react";
import { useId } from "react";
import { getCategoryImage } from "~/features/category/utils/categories";
import { Skeleton } from "~/shared/components/primitives/skeleton";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { type SearchSuggestions, type Suggestion, useSearchSuggestions } from "../hooks/use-search-suggestions";

/** Enfoca el buscador visible: el navbar monta uno en el riel y otro en la barra del teléfono. */
export function focusSearchField() {
  [...document.querySelectorAll<HTMLInputElement>("input[data-search-field]")]
    .find((el) => el.offsetParent !== null)
    ?.focus();
}

const GROUP_TITLE: Partial<Record<Suggestion["kind"], string>> = {
  recent: "Recientes",
  category: "Categorías",
  product: "Productos",
};

/**
 * Campo de búsqueda con sugerencias (combobox). Enter lleva a `/buscar?q=`; el panel se ubica con `panelClassName`.
 */
export function SearchField({
  categories,
  className,
  panelClassName,
}: {
  categories: CategoryItem[];
  className?: string;
  panelClassName?: string;
}) {
  const search = useSearchSuggestions(categories);
  const id = useId();
  const optionId = (i: number) => `${id}-option-${i}`;
  let lastGroup: string | undefined;

  return (
    <div className={cn("relative", className)}>
      <form
        action="/buscar"
        onSubmit={(e) => {
          // Sin JS el formulario igual lleva a /buscar; con JS, Enter lo resuelve el combobox.
          e.preventDefault();
        }}
      >
        {search.loading ? (
          <IconLoader2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-foreground" />
        ) : (
          <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <input
          data-search-field
          type="search"
          name="q"
          role="combobox"
          aria-label="Buscar productos"
          aria-expanded={search.open}
          aria-controls={`${id}-listbox`}
          aria-activedescendant={search.active >= 0 ? optionId(search.active) : undefined}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Buscar modelo o marca"
          value={search.value}
          onChange={(e) => search.change(e.target.value)}
          onFocus={() => search.setOpen(true)}
          onBlur={search.close}
          onKeyDown={search.onKeyDown}
          className="peer h-10 w-full rounded-xl border border-border/70 bg-background pr-3 pl-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/30"
        />
      </form>

      {search.open && search.items.length > 0 && (
        <div
          className={cn(
            "z-50 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl fade-in-0 zoom-in-[0.98] animate-in duration-fast",
            panelClassName,
          )}
        >
          <div
            id={`${id}-listbox`}
            role="listbox"
            aria-label="Sugerencias"
            className="max-h-[70dvh] overflow-y-auto p-2"
          >
            {search.items.map((item, i) => {
              const group = GROUP_TITLE[item.kind];
              const header = group && group !== lastGroup ? group : undefined;
              lastGroup = group;
              return (
                <div key={`${item.kind}-${item.to}`}>
                  {header && (
                    <p className="px-3 pt-3 pb-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                      {header}
                    </p>
                  )}
                  <SuggestionRow search={search} item={item} index={i} id={optionId(i)} />
                </div>
              );
            })}
            {search.loading && !search.items.some((item) => item.kind === "product") && (
              <div aria-hidden="true">
                <p className="px-3 pt-3 pb-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                  Buscando productos…
                </p>
                {[0, 1, 2].map((n) => (
                  <div key={n} className="flex items-center gap-3 px-3 py-1.5">
                    <Skeleton className="size-9 shrink-0 rounded-lg" />
                    <Skeleton className="h-3.5 flex-1 rounded-full" style={{ maxWidth: `${80 - n * 15}%` }} />
                    <Skeleton className="h-3.5 w-16 shrink-0 rounded-full" />
                  </div>
                ))}
              </div>
            )}
            {search.empty && (
              <p className="px-3 pt-3 pb-2 text-muted-foreground text-sm">
                No hay productos que coincidan con <span className="text-foreground">“{search.typed}”</span>. Prueba con
                el modelo completo o la marca.
              </p>
            )}
          </div>
          <p aria-live="polite" className="sr-only">
            {search.loading ? "Buscando…" : search.empty ? "Sin productos" : ""}
          </p>
          <div className="hidden items-center gap-4 border-border/60 border-t px-4 py-2 text-[11px] text-muted-foreground md:flex">
            <span>
              <kbd className="font-mono">↑↓</kbd> moverse
            </span>
            <span>
              <kbd className="font-mono">Enter</kbd> abrir
            </span>
            <span>
              <kbd className="font-mono">Esc</kbd> cerrar
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Resalta lo que completa el sistema, no lo que ya escribió la persona. */
function Completion({ text, typed }: { text: string; typed: string }) {
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

function SuggestionRow({
  search,
  item,
  index,
  id,
}: {
  search: SearchSuggestions;
  item: Suggestion;
  index: number;
  id: string;
}) {
  const active = search.active === index;
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      // mousedown y no click: el blur del campo cerraría el panel antes de que llegue el click.
      onMouseDown={(e) => {
        e.preventDefault();
        search.go(item);
      }}
      // mousemove y no mouseenter: un panel que aparece bajo el cursor quieto no debe elegir una opción.
      onMouseMove={() => search.active !== index && search.setActive(index)}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-1.5 text-left text-sm transition-colors",
        active ? "bg-secondary text-foreground" : "text-muted-foreground",
      )}
    >
      <SuggestionContent item={item} typed={search.value.trim()} />
    </div>
  );
}

function SuggestionContent({ item, typed }: { item: Suggestion; typed: string }) {
  switch (item.kind) {
    case "recent":
      return (
        <>
          <IconClock className="size-4 shrink-0" />
          <span className="truncate text-foreground">{item.label}</span>
        </>
      );
    case "query":
      return (
        <>
          <IconSearch className="size-4 shrink-0" />
          <span className="truncate">
            Buscar <span className="font-semibold text-foreground">“{item.label}”</span>
          </span>
          <kbd className="ml-auto hidden font-mono text-[10px] md:inline">Enter</kbd>
        </>
      );
    case "scoped":
      return (
        <>
          <span className="size-4 shrink-0" />
          <span className="truncate">
            <span className="text-foreground">{item.label}</span> en{" "}
            <span className="font-semibold text-foreground">{item.category.label}</span>
          </span>
        </>
      );
    case "category":
      return (
        <>
          <img src={getCategoryImage(item.category.slug)} alt="" className="size-7 shrink-0 rounded-lg object-cover" />
          <span className="truncate text-foreground">{item.category.label}</span>
          <span className="ml-auto text-xs tabular-nums">{item.category.productCount.toLocaleString("es-CL")}</span>
        </>
      );
    case "product":
      return (
        <>
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
            <Completion text={item.product.name} typed={typed} />
          </span>
          <span className="shrink-0 font-medium text-foreground tabular-nums">
            {item.product.bestPrice ? formatCLP(item.product.bestPrice) : "Sin stock"}
          </span>
          <IconArrowUpRight className="size-4 shrink-0" />
        </>
      );
  }
}
