import type { CategoryItem } from "@framerate/contracts";
import {
  IconCategory,
  IconChevronLeft,
  IconChevronRight,
  IconHome,
  IconLayoutGrid,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigation } from "react-router";
import { useUser } from "~/features/auth/hooks/useAuth";
import { CategoryIcon } from "~/features/category/components/category-icon";
import { CreateQuoteDialog } from "~/features/quote/components/create-quote-dialog";
import { focusSearchField, SearchField } from "~/features/search/components/search-field";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "../primitives/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";
import { Logo } from "./logo";
import { NavFps, TimeGradient } from "./nav-parts";
import { UserMenu } from "./user-menu";

const railLink = ({ isActive }: { isActive: boolean }) =>
  cn(
    "relative flex h-9 items-center gap-3 rounded-xl px-2.5 text-sm transition-[color,background-color,scale] active:scale-[0.97]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    isActive
      ? "bg-secondary font-medium text-foreground"
      : "text-foreground/65 hover:bg-secondary/60 hover:text-foreground",
  );

const iconButton =
  "grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl text-foreground/65 transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const tabClass = (active: boolean) =>
  cn(
    "flex flex-col items-center justify-center gap-0.5 font-medium text-[11px] transition-[color,scale] active:scale-[0.94]",
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

/** Plegado sólo queda el ícono: la etiqueta pasa a un tooltip a la derecha. */
function RailHint({ label, collapsed, children }: { label: string; collapsed: boolean; children: ReactNode }) {
  if (!collapsed) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={<div />}>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function RailLink({
  to,
  end,
  label,
  icon,
  count,
  collapsed,
  onClick,
  large,
}: {
  to: string;
  end?: boolean;
  label: string;
  icon: ReactNode;
  count?: number;
  collapsed?: boolean;
  onClick?: () => void;
  large?: boolean;
}) {
  return (
    <RailHint label={label} collapsed={!!collapsed}>
      <NavLink
        to={to}
        end={end}
        prefetch="intent"
        viewTransition
        onClick={onClick}
        aria-label={collapsed ? label : undefined}
        className={(state) =>
          cn(
            railLink(state),
            large && "h-12",
            collapsed && "w-9 justify-center px-0",
            state.isPending && "rail-pending",
          )
        }
      >
        {icon}
        {!collapsed && (
          <>
            <span className="truncate fade-in-0 slide-in-from-left-1 animate-in duration-base">{label}</span>
            {count !== undefined && <span className="ml-auto text-muted-foreground text-xs tabular-nums">{count}</span>}
          </>
        )}
      </NavLink>
    </RailHint>
  );
}

/**
 * Navegación del sitio. En escritorio, un riel fijo a la izquierda con el buscador y las categorías siempre a la
 * vista, que se pliega a sólo íconos; en teléfono, una barra superior con el buscador y pestañas abajo.
 */
export function Navbar({
  categories,
  collapsed,
  onCollapsedChange,
}: {
  categories: CategoryItem[];
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const user = useUser();
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focusAfterExpand, setFocusAfterExpand] = useState(false);
  const { pathname } = useLocation();
  const pendingPath = useNavigation().location?.pathname;
  const railRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({
    ready: false,
    animate: false,
    visible: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  // Mide el enlace activo sólo cuando cambia la página o el ancho del riel, nunca durante la animación.
  const measureIndicator = () => {
    // Al hacer clic la píldora ya va hacia el destino (pendiente) sin esperar a que cargue la página.
    const rail = railRef.current;
    const active =
      rail?.querySelector<HTMLElement>("a.rail-pending") ?? rail?.querySelector<HTMLElement>('a[aria-current="page"]');
    setIndicator((prev) =>
      active
        ? {
            ready: true,
            // La primera vez se ubica sin deslizarse.
            animate: prev.ready,
            visible: true,
            x: active.offsetLeft,
            y: active.offsetTop,
            width: active.offsetWidth,
            height: active.offsetHeight,
          }
        : { ...prev, visible: false },
    );
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: la página, la pendiente y el plegado cambian qué enlace y dónde.
  useLayoutEffect(measureIndicator, [pathname, collapsed, pendingPath]);

  // Buscar con el riel plegado lo despliega; el campo recién existe en el render siguiente.
  useEffect(() => {
    if (!collapsed && focusAfterExpand) {
      focusSearchField();
      setFocusAfterExpand(false);
    }
  }, [collapsed, focusAfterExpand]);

  const openSearch = () => {
    if (collapsed && window.matchMedia("(min-width: 64rem)").matches) {
      onCollapsedChange(false);
      setFocusAfterExpand(true);
    } else focusSearchField();
  };

  // `/` o Ctrl+K enfocan el buscador desde cualquier parte.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const quoteButton = (iconOnly: boolean) =>
    user && (
      <CreateQuoteDialog
        trigger={
          <button
            type="button"
            aria-label={iconOnly ? t("create_quote") : undefined}
            className={cn(
              "inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-foreground font-medium text-background text-sm transition-opacity hover:opacity-85",
              iconOnly ? "w-10" : "flex-1 px-3.5",
            )}
          >
            <IconPlus className="size-4" stroke={2.25} />
            {!iconOnly && t("create_quote")}
          </button>
        }
      />
    );

  const toggle = (
    <button
      type="button"
      onClick={() => onCollapsedChange(!collapsed)}
      aria-label={collapsed ? "Desplegar menú" : "Plegar menú"}
      aria-expanded={!collapsed}
      // Manija sobre el borde del riel, a la altura de la marca.
      className="absolute top-8 right-0 grid size-6 translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="t-icon-swap">
        <IconChevronLeft data-on={!collapsed} className="size-3.5" stroke={2} />
        <IconChevronRight data-on={collapsed} className="size-3.5" stroke={2} />
      </span>
    </button>
  );

  return (
    <>
      <TimeGradient />
      {/* El ancho (w-64 o w-16) lo repite root.tsx como padding del contenido. */}
      <aside
        // Con el ancho animado (equipos holgados) la píldora se vuelve a medir al terminar el cambio.
        onTransitionEnd={(e) => e.target === e.currentTarget && e.propertyName === "width" && measureIndicator()}
        className={cn(
          "t-resize fixed inset-y-0 left-0 z-40 hidden flex-col gap-4 border-border/60 border-r bg-card/40 py-3 lg:flex",
          collapsed ? "w-16 items-center px-2" : "w-64 px-3",
        )}
      >
        {toggle}
        {collapsed ? (
          <div className="pt-2">
            <Brand compact />
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2 pt-2">
            <Brand />
            <NavFps className="ml-auto" />
          </div>
        )}

        {collapsed ? (
          <RailHint label="Buscar" collapsed>
            <button type="button" onClick={openSearch} aria-label="Buscar" className={iconButton}>
              <IconSearch className="size-[18px]" stroke={1.75} />
            </button>
          </RailHint>
        ) : (
          <SearchField />
        )}

        {/* Una sola píldora detrás de los enlaces marca la sección activa y se desliza a la nueva al navegar. */}
        <div
          ref={railRef}
          data-ready={indicator.ready}
          className={cn(
            "relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto",
            "data-[ready=true]:[&_a[aria-current=page]]:bg-transparent",
            collapsed ? "items-center" : "-mx-1 px-1",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-0 left-0 rounded-xl bg-secondary",
              indicator.animate && "transition-[transform,opacity] duration-300 ease-[var(--badge-pop-ease)]",
            )}
            style={{
              width: indicator.width,
              height: indicator.height,
              transform: `translate(${indicator.x}px, ${indicator.y}px)`,
              opacity: indicator.visible ? 1 : 0,
            }}
          />
          <nav aria-label="Principal" className="flex flex-col gap-0.5">
            <RailLink
              to="/"
              end
              label="Inicio"
              collapsed={collapsed}
              icon={<IconHome className="size-[18px] shrink-0" stroke={1.75} />}
            />
            <RailLink
              to="/buscar"
              label="Todo el catálogo"
              collapsed={collapsed}
              icon={<IconLayoutGrid className="size-[18px] shrink-0" stroke={1.75} />}
            />
          </nav>

          <nav aria-label="Categorías" className="flex flex-col gap-0.5">
            {collapsed ? (
              <span className="mx-auto mb-1 h-px w-6 bg-border" />
            ) : (
              <p className="px-2.5 pb-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                Categorías
              </p>
            )}
            {categories.map((c) => (
              <RailLink
                key={c.id}
                to={`/categoria/${c.slug}`}
                label={c.label}
                count={c.productCount}
                collapsed={collapsed}
                icon={<CategoryIcon category={c.id} />}
              />
            ))}
          </nav>
        </div>

        <div
          className={cn("flex items-center gap-2 border-border/60 border-t pt-3", collapsed ? "flex-col" : "w-full")}
        >
          {quoteButton(collapsed)}
          <UserMenu
            align="start"
            side={collapsed ? "right" : "top"}
            loginClassName={collapsed ? "h-10 px-2.5" : "h-10 flex-1"}
          />
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-border/60 border-b bg-background/85 px-3 backdrop-blur-md lg:hidden">
        <Brand compact />
        <SearchField className="flex-1" />
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
        {/* Hoja que sube desde abajo (transitions.dev, "panel reveal"): se desliza en vez de crecer desde el centro. */}
        <DialogContent className="top-auto bottom-0 max-h-[80dvh] w-full max-w-none translate-y-0 overflow-y-auto rounded-t-3xl rounded-b-none border-x-0 border-b-0 p-3 pb-8 zoom-in-100 zoom-out-100 slide-in-from-bottom-24 slide-out-to-bottom-24 lg:hidden">
          <DialogTitle className="px-2.5 pt-2 pb-3">Categorías</DialogTitle>
          {categories.map((c) => (
            <RailLink
              key={c.id}
              to={`/categoria/${c.slug}`}
              label={c.label}
              count={c.productCount}
              large
              onClick={() => setSheetOpen(false)}
              icon={<CategoryIcon category={c.id} className="size-5" />}
            />
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
