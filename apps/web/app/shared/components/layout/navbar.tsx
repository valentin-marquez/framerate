import type { CategoryItem } from "@framerate/contracts";
import { IconCategory, IconHome, IconLayoutGrid, IconPlus, IconSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router";
import { useUser } from "~/features/auth/hooks/useAuth";
import { getCategoryImage } from "~/features/category/utils/categories";
import { CreateQuoteDialog } from "~/features/quote/components/create-quote-dialog";
import { focusSearchField, SearchField } from "~/features/search/components/search-field";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "../primitives/dialog";
import { Logo } from "./logo";
import { NavFps, TimeGradient } from "./nav-parts";
import { UserMenu } from "./user-menu";

const railLink = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex h-9 items-center gap-3 rounded-xl px-2.5 text-sm transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    isActive
      ? "bg-secondary font-medium text-foreground"
      : "text-foreground/65 hover:bg-secondary/60 hover:text-foreground",
  );

const tabClass = (active: boolean) =>
  cn(
    "flex flex-col items-center justify-center gap-0.5 font-medium text-[11px] transition-colors",
    active ? "text-foreground" : "text-foreground/50",
  );

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" prefetch="intent" className="flex shrink-0 items-center gap-2 text-foreground">
      <Logo className="size-6" />
      <span className={cn("font-semibold text-lg tracking-tight", compact && "sr-only")}>framerate</span>
    </Link>
  );
}

function CategoryLink({ category, onClick, large }: { category: CategoryItem; onClick?: () => void; large?: boolean }) {
  return (
    <NavLink
      to={`/categoria/${category.slug}`}
      prefetch="intent"
      viewTransition
      onClick={onClick}
      className={(state) => cn(railLink(state), large && "h-12")}
    >
      <img
        src={getCategoryImage(category.slug)}
        alt=""
        className={cn("shrink-0 object-cover", large ? "size-8 rounded-lg" : "size-6 rounded-md")}
      />
      <span className="truncate">{category.label}</span>
      <span className="ml-auto text-muted-foreground text-xs tabular-nums">{category.productCount}</span>
    </NavLink>
  );
}

/**
 * Navegación del sitio. En escritorio, un riel fijo a la izquierda con el buscador y las categorías siempre a la
 * vista; en teléfono, una barra superior con el buscador y pestañas abajo.
 */
export function Navbar({ categories }: { categories: CategoryItem[] }) {
  const user = useUser();
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);

  // `/` o Ctrl+K enfocan el buscador desde cualquier parte.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        focusSearchField();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <TimeGradient />
      {/* w-64: root.tsx desplaza el contenido lo mismo (lg:pl-64). */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col gap-4 border-border/60 border-r bg-card/40 p-3 lg:flex">
        <div className="px-2 pt-2">
          <Brand />
        </div>
        <SearchField categories={categories} panelClassName="absolute top-0 left-full ml-3 w-[30rem]" />
        <nav aria-label="Principal" className="flex flex-col gap-0.5">
          <NavLink to="/" end prefetch="intent" className={railLink}>
            <IconHome className="size-[18px]" stroke={1.75} />
            Inicio
          </NavLink>
          <NavLink to="/buscar" prefetch="intent" className={railLink}>
            <IconLayoutGrid className="size-[18px]" stroke={1.75} />
            Todo el catálogo
          </NavLink>
        </nav>
        <nav aria-label="Categorías" className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
          <p className="px-2.5 pb-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
            Categorías
          </p>
          {categories.map((c) => (
            <CategoryLink key={c.id} category={c} />
          ))}
        </nav>
        <div className="flex items-center gap-2 border-border/60 border-t pt-3">
          {user && (
            <CreateQuoteDialog
              trigger={
                <button
                  type="button"
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-foreground px-3.5 font-medium text-background text-sm transition-opacity hover:opacity-85"
                >
                  <IconPlus className="size-4" stroke={2.25} />
                  {t("create_quote")}
                </button>
              }
            />
          )}
          <NavFps className="ml-auto" />
          <UserMenu align="start" side="top" />
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-border/60 border-b bg-background/85 px-3 backdrop-blur-md lg:hidden">
        <Brand compact />
        <SearchField categories={categories} className="flex-1" panelClassName="fixed inset-x-3 top-16" />
        <UserMenu />
      </header>

      <nav
        aria-label="Atajos"
        className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-3 border-border/60 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <NavLink to="/" end prefetch="intent" className={({ isActive }) => tabClass(isActive)}>
          <IconHome className="size-5" stroke={1.75} />
          Inicio
        </NavLink>
        <button type="button" className={tabClass(sheetOpen)} onClick={() => setSheetOpen(true)}>
          <IconCategory className="size-5" stroke={1.75} />
          Categorías
        </button>
        <button type="button" className={tabClass(false)} onClick={focusSearchField}>
          <IconSearch className="size-5" stroke={1.75} />
          Buscar
        </button>
      </nav>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="top-auto bottom-0 max-h-[80dvh] w-full max-w-none translate-y-0 overflow-y-auto rounded-t-3xl rounded-b-none border-x-0 border-b-0 p-3 pb-8 lg:hidden">
          <DialogTitle className="px-2.5 pt-2 pb-3">Categorías</DialogTitle>
          {categories.map((c) => (
            <CategoryLink key={c.id} category={c} large onClick={() => setSheetOpen(false)} />
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
