// PROTOTIPO (#108) C "Riel": el sitio como herramienta (X, YouTube, BuildCores). Barra lateral fija con el
// buscador arriba y las 10 categorías siempre a la vista; en teléfono, barra superior con el buscador y
// pestañas abajo. Las sugerencias flotan a la derecha del campo.
import type { CategoryItem } from "@framerate/contracts";
import { IconCategory, IconHome, IconLayoutGrid, IconSearch, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { NavLink } from "react-router";
import { getCategoryImage } from "~/features/category/utils/categories";
import { cn } from "~/shared/lib/utils";
import { UserMenu } from "../user-menu";
import { Brand, KeyHints, QuoteAction } from "./shared";
import { inputProps, SuggestionGroups } from "./suggestion-row";
import { type NavSearch, useNavSearch } from "./use-nav-search";

export const name = "Riel";

const railLink = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex h-9 items-center gap-3 rounded-xl px-2.5 text-sm transition-colors",
    isActive
      ? "bg-secondary font-medium text-foreground"
      : "text-foreground/65 hover:bg-secondary/60 hover:text-foreground",
  );

function Field({ search, className }: { search: NavSearch; className?: string }) {
  return (
    <form
      action="/buscar"
      onSubmit={(e) => {
        e.preventDefault();
        search.submit();
      }}
      className={cn("relative", className)}
    >
      <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        {...inputProps(search)}
        placeholder="Buscar modelo o marca"
        className="peer h-10 w-full rounded-xl border border-border/70 bg-background pr-9 pl-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/30"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 font-mono text-muted-foreground text-xs peer-focus:opacity-0 lg:inline">
        /
      </kbd>
    </form>
  );
}

export function VariantC({ categories }: { categories: CategoryItem[] }) {
  const search = useNavSearch(categories);
  const [sheet, setSheet] = useState(false);

  const suggestions = search.open && (
    <div className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl fade-in-0 zoom-in-[0.98] animate-in duration-fast lg:absolute lg:inset-x-auto lg:top-0 lg:left-full lg:ml-3 lg:w-[30rem]">
      <div className="max-h-[70dvh] overflow-y-auto p-2">
        <SuggestionGroups search={search} dense />
      </div>
      <KeyHints />
    </div>
  );

  return (
    <>
      {/* Escritorio: riel */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col gap-4 border-border/60 border-r bg-card/40 p-3 lg:flex">
        <Brand className="px-2 pt-2" />
        <div className="relative">
          <Field search={search} />
          {suggestions}
        </div>
        <nav aria-label="Principal" className="flex flex-col gap-0.5">
          <NavLink to="/" end className={railLink}>
            <IconHome className="size-[18px]" /> Inicio
          </NavLink>
          <NavLink to="/buscar" className={railLink}>
            <IconLayoutGrid className="size-[18px]" /> Todo el catálogo
          </NavLink>
        </nav>
        <nav aria-label="Categorías" className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
          <p className="px-2.5 pb-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
            Categorías
          </p>
          {categories.map((c) => (
            <NavLink key={c.id} to={`/categoria/${c.slug}`} prefetch="intent" viewTransition className={railLink}>
              <img src={getCategoryImage(c.slug)} alt="" className="size-6 rounded-md object-cover" />
              <span className="truncate">{c.label}</span>
              <span className="ml-auto text-muted-foreground text-xs tabular-nums">{c.productCount}</span>
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-2 border-border/60 border-t pt-3">
          <QuoteAction />
          <UserMenu align="start" side="top" />
        </div>
      </aside>

      {/* Teléfono y tableta: barra superior con el buscador */}
      <div className="sticky top-0 z-50 flex h-14 items-center gap-3 border-border/60 border-b bg-background px-3 lg:hidden">
        <Brand className="[&>span]:hidden" />
        <Field search={search} className="flex-1" />
        <UserMenu />
        {suggestions}
      </div>

      {/* Pestañas abajo */}
      <nav
        aria-label="Atajos"
        className="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-3 border-border/60 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <NavLink to="/" end className={({ isActive }) => tab(isActive)}>
          <IconHome className="size-5" /> Inicio
        </NavLink>
        <button type="button" className={tab(sheet)} onClick={() => setSheet(true)}>
          <IconCategory className="size-5" /> Categorías
        </button>
        <button type="button" className={tab(false)} onClick={() => search.focus()}>
          <IconSearch className="size-5" /> Buscar
        </button>
      </nav>

      {sheet && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/45 fade-in-0 animate-in"
            onClick={() => setSheet(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-3xl bg-card p-3 pb-8 slide-in-from-bottom-6 animate-in duration-base">
            <div className="flex items-center justify-between px-2 pb-2">
              <p className="font-semibold">Categorías</p>
              <button type="button" aria-label="Cerrar" onClick={() => setSheet(false)} className="p-1">
                <IconX className="size-5" />
              </button>
            </div>
            {categories.map((c) => (
              <NavLink
                key={c.id}
                to={`/categoria/${c.slug}`}
                onClick={() => setSheet(false)}
                className={(s) => cn(railLink(s), "h-12")}
              >
                <img src={getCategoryImage(c.slug)} alt="" className="size-8 rounded-lg object-cover" />
                <span>{c.label}</span>
                <span className="ml-auto text-muted-foreground text-xs tabular-nums">{c.productCount}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

const tab = (active: boolean) =>
  cn(
    "flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
    active ? "text-foreground" : "text-foreground/50",
  );
