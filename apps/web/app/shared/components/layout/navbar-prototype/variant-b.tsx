// PROTOTIPO (#108) B "Comando": el buscador es la pieza central; al enfocarlo la barra se abre en un panel
// a todo el ancho y oscurece la página (Apple, Superbar). Categorías como chips con su cantidad (Google Maps, QRQ).
import type { CategoryItem } from "@framerate/contracts";
import { IconSearch } from "@tabler/icons-react";
import { NavLink } from "react-router";
import { getCategoryImage } from "~/features/category/utils/categories";
import { cn } from "~/shared/lib/utils";
import { UserMenu } from "../user-menu";
import { Brand, KeyHints, QuoteAction } from "./shared";
import { inputProps, SuggestionGroups } from "./suggestion-row";
import { useNavSearch } from "./use-nav-search";

export const name = "Comando";

export function VariantB({ categories }: { categories: CategoryItem[] }) {
  const search = useNavSearch(categories);
  const empty = !search.value.trim();

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-black/45 transition-opacity duration-base",
          search.open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <header className="sticky top-0 z-50 bg-background">
        <div className="relative z-10 flex h-16 items-center gap-3 bg-background px-4 md:gap-8 md:px-6">
          <Brand className="[&>span]:hidden md:[&>span]:inline" />

          <form
            action="/buscar"
            onSubmit={(e) => {
              e.preventDefault();
              search.submit();
            }}
            className="relative min-w-0 flex-1 md:mx-auto md:max-w-2xl"
          >
            <IconSearch className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              {...inputProps(search)}
              placeholder="Busca un modelo: RTX 4070, 7800X3D…"
              className="peer h-11 w-full rounded-full border border-transparent bg-secondary pr-4 pl-12 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-border focus:border-foreground/20 focus:bg-card md:pr-12"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-4 hidden size-6 -translate-y-1/2 place-items-center rounded-md border border-border font-mono text-muted-foreground text-xs peer-focus:opacity-0 md:grid">
              /
            </kbd>
          </form>

          <div className="flex shrink-0 items-center gap-3">
            <QuoteAction className="hidden sm:inline-flex" />
            <UserMenu />
          </div>
        </div>

        <nav aria-label="Categorías" className="scrollbar-hide overflow-x-auto border-border/60 border-b">
          <ul className="mx-auto flex w-max gap-2 px-4 pb-3 md:px-6">
            {categories.map((c) => (
              <li key={c.id}>
                <NavLink
                  to={`/categoria/${c.slug}`}
                  prefetch="intent"
                  viewTransition
                  className={({ isActive }) =>
                    cn(
                      "inline-flex h-9 items-center gap-2 rounded-full border py-1 pr-3.5 pl-1 text-sm transition-colors",
                      isActive
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/70 text-foreground/75 hover:border-foreground/30 hover:text-foreground",
                    )
                  }
                >
                  <img src={getCategoryImage(c.slug)} alt="" className="size-7 rounded-full object-cover" />
                  <span className="whitespace-nowrap font-medium">{c.label}</span>
                  <span className="text-xs tabular-nums opacity-55">{c.productCount}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {search.open && (
          <div className="absolute inset-x-0 top-16 z-0 border-border/60 border-b bg-background shadow-2xl fade-in-0 slide-in-from-top-2 animate-in duration-fast">
            <div className="mx-auto max-h-[calc(100dvh-5rem)] max-w-2xl overflow-y-auto px-2 py-3 md:px-0">
              {empty ? <EmptyPanel search={search} categories={categories} /> : <SuggestionGroups search={search} />}
            </div>
            <KeyHints />
          </div>
        )}
      </header>
    </>
  );
}

/** Con el campo vacío: recientes en fila y las categorías como mosaico con foto. */
function EmptyPanel({ search, categories }: { search: ReturnType<typeof useNavSearch>; categories: CategoryItem[] }) {
  const recents = search.items.filter((i) => i.kind === "recent");
  return (
    <div role="listbox" id="nav-suggestions" className="flex flex-col gap-4 px-2">
      {recents.length > 0 && (
        <section>
          <p className="pb-2 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">Recientes</p>
          <div className="flex flex-wrap gap-2">
            {recents.map((item, i) => (
              <button
                key={item.to}
                id={`nav-suggestion-${i}`}
                type="button"
                role="option"
                aria-selected={search.active === i}
                onMouseDown={(e) => {
                  e.preventDefault();
                  search.go(item);
                }}
                className={cn(
                  "h-8 rounded-full border border-border/70 px-3 text-sm",
                  search.active === i ? "bg-secondary text-foreground" : "text-foreground/75",
                )}
              >
                {item.kind === "recent" && item.label}
              </button>
            ))}
          </div>
        </section>
      )}
      <section>
        <p className="pb-2 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
          Explora por categoría
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {categories.map((c, ci) => {
            const i = recents.length + ci;
            return (
              <button
                key={c.id}
                id={`nav-suggestion-${i}`}
                type="button"
                role="option"
                aria-selected={search.active === i}
                onMouseDown={(e) => {
                  e.preventDefault();
                  search.go({ kind: "category", category: c, to: `/categoria/${c.slug}` });
                }}
                onMouseEnter={() => search.setActive(i)}
                className={cn(
                  "group relative flex h-24 flex-col justify-end overflow-hidden rounded-2xl p-2.5 text-left outline-none ring-foreground transition-shadow",
                  search.active === i && "ring-2",
                )}
              >
                <img
                  src={getCategoryImage(c.slug)}
                  alt=""
                  className="absolute inset-0 size-full object-cover transition-transform duration-base group-hover:scale-105"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                <span className="relative font-medium text-sm text-white leading-tight">{c.label}</span>
                <span className="relative text-[11px] text-white/70 tabular-nums">{c.productCount} productos</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
