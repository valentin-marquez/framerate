import { CATEGORY_NAV_LABELS, type CategoryItem, type Freshness } from "@framerate/contracts";
import {
  IconCategory,
  IconChevronLeft,
  IconChevronRight,
  IconHome,
  IconLayoutGrid,
  IconLayoutList,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";
import {
  createContext,
  lazy,
  type ReactNode,
  Suspense,
  use,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Link, NavLink, useLocation, useMatches, useNavigation, useSearchParams } from "react-router";
import { useProfile, useUser } from "~/features/auth/hooks/useAuth";
import { CategoryPanel } from "~/features/catalog/components/category-panel";
import { activeFilterCount } from "~/features/catalog/components/filter-panel";
import type { CatalogData } from "~/features/catalog/load-catalog";
import { CategoryIcon } from "~/features/category/components/category-icon";
import { focusSearchField, SearchField, startSearchSpotlight } from "~/features/search/components/search-field";
import { cn } from "~/shared/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "../primitives/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";
import { ThemeToggle } from "../theme/theme-toggle";
import { Logo } from "./logo";
import { OfferFreshness, TimeGradient } from "./nav-parts";
import { UserMenu } from "./user-menu";

// Los diálogos se descargan al abrirse por primera vez: el navbar está en todas las páginas y no deben pesar en la carga.
const LoginDialog = lazy(() =>
  import("~/features/auth/components/login-dialog").then((m) => ({ default: m.LoginDialog })),
);
const CreateQuoteDialog = lazy(() =>
  import("~/features/quote/components/create-quote-dialog").then((m) => ({ default: m.CreateQuoteDialog })),
);

const railLink = (current: boolean) =>
  cn(
    "relative flex h-9 items-center gap-3 rounded-xl px-2.5 text-sm transition-[color,background-color,scale] active:scale-[0.985]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    current
      ? "bg-secondary text-foreground"
      : "text-foreground/75 hover:bg-secondary/60 hover:text-foreground dark:text-foreground/65",
  );

/**
 * Hacia dónde va el riel: lo último que se tocó (estado urgente, se dibuja en el mismo cuadro del clic), si no la
 * navegación pendiente, si no la página actual. Píldora, texto activo y la sección que se apaga siguen este destino,
 * así el clic se ve completo de una vez y no en dos tiempos.
 */
const RailTarget = createContext<{ target: string; select: (to: string) => void }>({
  target: "",
  select: () => {},
});

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

/**
 * Angosto, sólo se ve el ícono y la etiqueta pasa a un tooltip a la derecha. El árbol es siempre el mismo (el tooltip
 * sólo se habilita): plegar no vuelve a montar los enlaces.
 */
function RailHint({ label, collapsed, children }: { label: string; collapsed: boolean; children: ReactNode }) {
  return (
    <Tooltip disabled={!collapsed}>
      <TooltipTrigger render={<div className="w-full" />}>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function RailBadge({ n, className }: { n: number; className?: string }) {
  return (
    <span
      className={cn(
        "grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground tabular-nums",
        className,
      )}
    >
      {n}
    </span>
  );
}

function RailLink({
  to,
  end,
  label,
  icon,
  count,
  badge,
  collapsed,
  onClick,
  large,
}: {
  to: string;
  end?: boolean;
  label: string;
  icon: ReactNode;
  count?: number;
  /** Filtros aplicados en esa categoría: sustituye al conteo, y plegado va sobre el ícono. */
  badge?: number;
  collapsed?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  large?: boolean;
}) {
  const { target, select } = use(RailTarget);
  const current = end ? target === to : target === to || target.startsWith(`${to}/`);
  return (
    <RailHint label={label} collapsed={!!collapsed}>
      <NavLink
        to={to}
        end={end}
        prefetch="intent"
        // Sin viewTransition: mientras dura una, Chrome manda los clics a la raíz y los clics rápidos en el riel se
        // perdían. La píldora y la entrada de resultados ya dan la continuidad.
        onClick={(e) => {
          // Ctrl/Cmd/Shift+clic abre otra pestaña: este riel no navega.
          if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) select(to);
          onClick?.(e);
        }}
        aria-label={collapsed ? label : undefined}
        data-current={current}
        className={cn(railLink(current), large && "h-12")}
      >
        <span className="relative shrink-0">
          {icon}
          {!!badge && <RailBadge n={badge} className="rail-icon absolute -top-1.5 -right-2" />}
        </span>
        <span className="rail-label truncate">{label}</span>
        {badge ? (
          <RailBadge n={badge} className="rail-label ml-auto" />
        ) : (
          count !== undefined && (
            <span className="rail-label ml-auto text-muted-foreground text-xs tabular-nums">{count}</span>
          )
        )}
      </NavLink>
    </RailHint>
  );
}

/**
 * Entrada a las cotizaciones. Con sesión van a tu perfil, donde están listadas; sin ella, al ingreso (`/perfil` sólo
 * devuelve al inicio). Crear abre el diálogo de siempre. Cada diálogo queda montado tras abrirse, para cerrar con su
 * animación.
 */
function useQuoteEntry() {
  const user = useUser();
  const profile = useProfile();
  const [open, setOpen] = useState<"login" | "create" | null>(null);
  const [mounted, setMounted] = useState<"login" | "create" | null>(null);
  const show = (dialog: "login" | "create") => {
    setMounted(dialog);
    setOpen(dialog);
  };
  const onOpenChange = (next: boolean) => {
    if (!next) setOpen(null);
  };
  const dialogs = mounted && (
    <Suspense fallback={null}>
      {mounted === "login" ? (
        <LoginDialog open={open === "login"} onOpenChange={onOpenChange} />
      ) : (
        <CreateQuoteDialog open={open === "create"} onOpenChange={onOpenChange} />
      )}
    </Suspense>
  );
  return { signedIn: !!user, href: profile?.username ? `/u/${profile.username}` : "/perfil", show, dialogs };
}

/**
 * Fila "Mis cotizaciones" del riel, con un "+" para crear a su derecha (sólo con sesión). Fila y "+" comparten celda de una
 * grilla y no una caja `relative`: la píldora de sección mide el enlace con `offsetTop` y ese ancestro la descuadraría.
 */
function QuotesRailRow({ collapsed }: { collapsed: boolean }) {
  const { signedIn, href, show, dialogs } = useQuoteEntry();
  const icon = <IconLayoutList className="size-[18px] shrink-0" stroke={1.75} />;
  return (
    // `minmax(0,1fr)`: sin ella la columna mide el texto de la etiqueta y, plegado, el tooltip se ancla lejos del ícono.
    <div className="grid grid-cols-[minmax(0,1fr)] items-center [&>*]:col-start-1 [&>*]:row-start-1">
      {signedIn ? (
        <RailLink to={href} label="Mis cotizaciones" collapsed={collapsed} icon={icon} />
      ) : (
        <RailHint label="Mis cotizaciones" collapsed={collapsed}>
          <button
            type="button"
            aria-label={collapsed ? "Mis cotizaciones" : undefined}
            onClick={() => show("login")}
            className={cn(railLink(false), "w-full cursor-pointer")}
          >
            {icon}
            <span className="rail-label truncate">Mis cotizaciones</span>
          </button>
        </RailHint>
      )}
      {signedIn && (
        <button
          type="button"
          aria-label="Crear cotización"
          title="Crear cotización"
          onClick={() => show("create")}
          className="rail-label z-10 mr-1.5 flex size-6 cursor-pointer items-center justify-center justify-self-end rounded-lg text-foreground/70 transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <IconPlus className="size-3.5" stroke={2} />
        </button>
      )}
      {dialogs}
    </div>
  );
}

/** Pestaña "Cotizaciones" de la barra inferior del teléfono: crear queda en el perfil y en el menú del avatar. */
function QuotesTab() {
  const { signedIn, href, show, dialogs } = useQuoteEntry();
  const content = (
    <>
      <IconLayoutList className="size-5" stroke={1.75} />
      Cotizaciones
    </>
  );
  return (
    <>
      {signedIn ? (
        <NavLink to={href} prefetch="intent" className={({ isActive }) => tabClass(isActive)}>
          {content}
        </NavLink>
      ) : (
        <button type="button" className={tabClass(false)} onClick={() => show("login")}>
          {content}
        </button>
      )}
      {dialogs}
    </>
  );
}

/**
 * Zona del riel con su propia píldora de sección activa, que se desliza al enlace nuevo. Hay una por zona porque la
 * lista de categorías scrollea aparte y la píldora tiene que viajar con ella. La píldora ocupa el ancho por CSS
 * (también mientras el riel cambia); sólo se mide su posición vertical, que plegar no cambia: se mide al navegar.
 */
function RailGroup({ className, children }: { className?: string; children: ReactNode }) {
  const { target } = use(RailTarget);
  const ref = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ ready: false, animate: false, visible: false, y: 0, height: 0 });
  // biome-ignore lint/correctness/useExhaustiveDependencies: el destino cambia qué enlace está activo.
  useLayoutEffect(() => {
    const active = ref.current?.querySelector<HTMLElement>('a[data-current="true"]');
    setIndicator((prev) =>
      active
        ? // La primera vez se ubica sin deslizarse.
          { ready: true, animate: prev.ready, visible: true, y: active.offsetTop, height: active.offsetHeight }
        : { ...prev, visible: false },
    );
  }, [target]);

  return (
    <div
      ref={ref}
      data-ready={indicator.ready}
      className={cn("relative data-[ready=true]:[&_a[data-current=true]]:bg-transparent", className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 rounded-xl bg-secondary",
          indicator.animate && "transition-[transform,opacity] duration-300 ease-[var(--badge-pop-ease)]",
        )}
        style={{
          height: indicator.height,
          transform: `translateY(${indicator.y}px)`,
          opacity: indicator.visible ? 1 : 0,
        }}
      />
      {children}
    </div>
  );
}

// Pasó la hidratación: un panel que se monta desde aquí es de una navegación y entra deslizándose; el de la carga
// inicial ya está en su lugar.
let hydrated = false;

/**
 * Panel de filtros a la derecha del riel compacto. Siempre montado: abrir y cerrar lo desliza desde detrás del riel
 * (sólo transform, sin fundido, para que se lea como movimiento de lado a lado); la caja recorta, así no se ve sobre
 * el riel.
 */
function FiltersAside({ open, data }: { open: boolean; data: CatalogData }) {
  const [enter] = useState(hydrated);
  return (
    <aside
      aria-label="Filtros"
      inert={!open}
      className={cn(
        "fixed inset-y-0 left-16 z-30 hidden w-64 overflow-hidden lg:block",
        !open && "pointer-events-none",
      )}
    >
      <div
        className={cn(
          "rail-surface flex h-full flex-col gap-4 border-border/60 border-r p-3 transition-transform duration-base ease-in-out motion-reduce:transition-none",
          open ? "translate-x-0" : "-translate-x-full",
          enter && "slide-in-from-left-full animate-in duration-base ease-in-out motion-reduce:animate-none",
        )}
      >
        <CategoryPanel data={data} />
      </div>
    </aside>
  );
}

/**
 * Navegación del sitio. En escritorio, un riel fijo a la izquierda con el buscador y las categorías siempre a la
 * vista, que se pliega a sólo íconos; en teléfono, una barra superior con el buscador y pestañas abajo.
 */
export function Navbar({
  categories,
  freshness,
  initialCollapsed,
  mobile = false,
}: {
  categories: CategoryItem[];
  /** Sin dato (la API falló) no se muestra. */
  freshness?: Freshness;
  initialCollapsed: boolean;
  /** El servidor vio un teléfono: no manda el riel ni el panel de filtros, que son sólo de escritorio. */
  mobile?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  // Si después la pantalla es ancha (teléfono en horizontal, ventana que crece), el riel y el panel se montan entonces.
  const [wideScreen, setWideScreen] = useState(false);
  useEffect(() => {
    if (!mobile) return;
    const query = window.matchMedia("(min-width: 64rem)");
    const sync = () => setWideScreen(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [mobile]);
  const showDesktop = !mobile || wideScreen;
  // El hueco del contenido lo pone `data-rail` en el <html> (app.css): plegar no vuelve a renderizar la página.
  const onCollapsedChange = (next: boolean) => {
    setCollapsed(next);
    document.documentElement.dataset.rail = next ? "collapsed" : "open";
    // biome-ignore lint/suspicious/noDocumentCookie: preferencia de interfaz sin datos sensibles.
    document.cookie = `rail=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };
  const [sheetOpen, setSheetOpen] = useState(false);
  // Asomarse: con el riel plegado, buscar lo abre por encima del contenido (sin moverlo ni cambiar la preferencia) y
  // se vuelve a plegar al salir del riel.
  const [peek, setPeek] = useState(false);
  const { pathname } = useLocation();
  const pendingPath = useNavigation().location?.pathname;
  const [selected, setSelected] = useState<string | null>(null);
  // En una categoría, el riel queda compacto y sus filtros van en un panel a su derecha (los datos son los del loader
  // de esa ruta). Fuera de ella, sigue la preferencia guardada.
  const catalog = useMatches().find((m) => m.id === "features/category/pages/category-page")?.loaderData as
    | CatalogData
    | undefined;
  const inCategory = !!catalog;
  // Al salir de la categoría el panel sigue montado, con sus últimos datos, mientras se desliza hacia afuera.
  const lastCatalog = useRef(catalog);
  if (catalog) lastCatalog.current = catalog;
  const shownCatalog = catalog ?? lastCatalog.current;
  useEffect(() => {
    hydrated = true;
  }, []);
  const [panelOpen, setPanelOpen] = useState(true);
  const compact = collapsed || inCategory;
  const wide = !compact || peek;
  // El hueco del contenido en la categoría lo pone `data-panel` en el <html> (app.css): root.tsx lo fija desde la ruta y
  // aquí sólo se cambia al plegar el panel, sin volver a renderizar la página.
  useEffect(() => {
    const root = document.documentElement;
    if (inCategory) root.dataset.panel = panelOpen ? "open" : "closed";
    else delete root.dataset.panel;
  }, [inCategory, panelOpen]);
  const activeFilters = activeFilterCount(useSearchParams()[0]);
  // Cuando la URL llega (o la navegación se cancela) manda la navegación real.
  // biome-ignore lint/correctness/useExhaustiveDependencies: se limpia en cada cambio de página o de pendiente.
  useEffect(() => setSelected(null), [pathname, pendingPath]);
  const railTarget = { target: selected ?? pendingPath ?? pathname, select: setSelected };

  // `/` o Ctrl+K enfocan el buscador desde cualquier parte; con el riel plegado, se asoma. Ctrl+B pliega y despliega. El campo existe siempre
  // (angosto sólo se recorta), así que el foco y el desenfoque de Ctrl+K son inmediatos.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      // Ctrl/Cmd+B pliega o despliega el riel (y cierra uno asomado); en una categoría, el panel de filtros. Sin
      // preventDefault, Firefox abre los marcadores.
      if (e.key === "b" && (e.ctrlKey || e.metaKey) && window.matchMedia("(min-width: 64rem)").matches) {
        e.preventDefault();
        if (inCategory) setPanelOpen((open) => !open);
        else if (peek) {
          setPeek(false);
          (document.activeElement as HTMLElement | null)?.blur();
        } else onCollapsedChange(!collapsed);
        return;
      }
      // F pliega y despliega el panel de filtros de la categoría abierta.
      if (e.key === "f" && inCategory && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (window.matchMedia("(min-width: 64rem)").matches) {
          e.preventDefault();
          setPanelOpen((open) => !open);
        }
        return;
      }
      const shortcut = e.key === "k" && (e.ctrlKey || e.metaKey);
      if (shortcut || (e.key === "/" && !typing)) {
        e.preventDefault();
        // En una categoría el buscador vive en el panel: no hay riel plegado que asomar.
        if (compact && !inCategory && window.matchMedia("(min-width: 64rem)").matches) setPeek(true);
        const focus = () => {
          focusSearchField();
          if (shortcut) startSearchSpotlight();
        };
        // Con el panel plegado el buscador no se ve: se despliega y se enfoca cuando ya está en pantalla.
        if (inCategory && !panelOpen) {
          setPanelOpen(true);
          requestAnimationFrame(focus);
        } else focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <RailTarget value={railTarget}>
      <TimeGradient />
      {showDesktop && (
        <>
          {/* Manija fuera del riel (que recorta su contenido): sigue su borde con transform, no con left. En una categoría
          es la del panel de filtros: el riel siempre está compacto. */}
          <button
            type="button"
            onClick={() => {
              if (inCategory) {
                setPanelOpen((open) => !open);
                return;
              }
              setPeek(false);
              onCollapsedChange(!collapsed);
            }}
            aria-label={
              inCategory
                ? panelOpen
                  ? "Plegar filtros"
                  : "Mostrar filtros"
                : collapsed
                  ? "Desplegar menú"
                  : "Plegar menú"
            }
            aria-expanded={inCategory ? panelOpen : !collapsed}
            className={cn(
              "t-rail-handle fixed top-8 left-0 z-50 hidden size-6 cursor-pointer place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "lg:grid",
              inCategory ? (panelOpen ? "[--rail:20rem]" : "[--rail:4rem]") : wide ? "[--rail:16rem]" : "[--rail:4rem]",
            )}
          >
            <span className="t-icon-swap">
              <IconChevronLeft data-on={inCategory ? panelOpen : wide} className="size-3.5" stroke={2} />
              <IconChevronRight data-on={inCategory ? !panelOpen : !wide} className="size-3.5" stroke={2} />
            </span>
          </button>
          {/*
        Un solo diseño para plegado y desplegado: los íconos quedan en la misma columna (centro a 32 px) y sólo cambia
        el ancho; lo que no cabe se recorta y las etiquetas se desvanecen (.rail-label en app.css). `data-rail`
        desplaza el contenido (asomarse no lo mueve).
      */}
          <aside
            data-wide={wide}
            style={{ viewTransitionName: "nav-rail" }}
            onFocus={(e) => {
              if (compact && (e.target as HTMLElement).matches("input[data-search-field]")) setPeek(true);
            }}
            onBlur={(e) => {
              // Un campo de filtros abre su lista fuera del riel (`data-rail-popup`): el foco sigue siendo del riel.
              const to = e.relatedTarget as HTMLElement | null;
              if (!e.currentTarget.contains(to) && !to?.closest("[data-rail-popup]")) setPeek(false);
            }}
            className={cn(
              "t-resize fixed inset-y-0 left-0 z-40 hidden scrollbar-slim flex-col gap-4 overflow-y-auto overflow-x-hidden border-border/60 border-r px-3 py-3 lg:flex",
              wide ? "w-64" : "w-16",
              peek ? "bg-card shadow-2xl" : "rail-solid",
            )}
          >
            <div className="flex h-10 shrink-0 items-center gap-2 px-2">
              <Link to="/" prefetch="intent" className="flex shrink-0 items-center gap-2 text-foreground">
                <Logo className="size-6 shrink-0" />
                <span className="rail-label font-semibold text-lg tracking-tight">framerate</span>
              </Link>
            </div>

            {/* El riel plegado se ve igual en todas las vistas. En una categoría el buscador va en el panel, bajo el título, y
            aquí queda el hueco de la lupa, vacío, para que los íconos de abajo no suban: el campo sigue montado y se
            desvanece, no desaparece de golpe al achicarse el riel. */}
            <div
              inert={inCategory}
              className={cn(
                "shrink-0 transition-opacity duration-base ease-out",
                inCategory && "pointer-events-none opacity-0",
              )}
            >
              <SearchField />
            </div>

            {/* Fijo: sólo scrollea la lista de categorías. Cada zona lleva su píldora de sección activa. */}
            <RailGroup className="flex shrink-0 flex-col gap-4">
              <nav aria-label="Principal" className="flex flex-col gap-0.5">
                <RailLink
                  to="/"
                  end
                  label="Inicio"
                  collapsed={!wide}
                  icon={<IconHome className="size-[18px] shrink-0" stroke={1.75} />}
                />
                <RailLink
                  to="/buscar"
                  label="Todo el catálogo"
                  collapsed={!wide}
                  icon={<IconLayoutGrid className="size-[18px] shrink-0" stroke={1.75} />}
                />
                <QuotesRailRow collapsed={!wide} />
              </nav>
            </RailGroup>

            {/* El alto mínimo hace que, en una ventana muy baja, scrollee el riel entero y no se aplaste la lista. */}
            <div className="relative min-h-40 flex-1">
              <nav aria-label="Categorías" className="absolute inset-0 flex flex-col">
                {/* Angosto, el título cede su lugar a una línea en la columna de íconos. */}
                <div className="relative shrink-0">
                  <p className="rail-label px-2.5 pb-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                    Categorías
                  </p>
                  <span aria-hidden="true" className="rail-icon absolute top-1/2 left-2 h-px w-6 bg-border" />
                </div>
                <RailGroup className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
                  {categories.map((c) => {
                    const open = !!catalog && c.slug === catalog.category;
                    return (
                      <RailLink
                        key={c.id}
                        to={`/categoria/${c.slug}`}
                        label={CATEGORY_NAV_LABELS[c.id]}
                        count={c.productCount}
                        badge={open ? activeFilters : undefined}
                        collapsed={!wide}
                        // En la categoría abierta, tocarla muestra sus filtros en vez de recargarla sin ellos.
                        onClick={(e) => {
                          if (!open) return;
                          e.preventDefault();
                          setPanelOpen(true);
                        }}
                        icon={<CategoryIcon category={c.id} />}
                      />
                    );
                  })}
                </RailGroup>
              </nav>
            </div>

            <div className="flex shrink-0 flex-col gap-3 border-border/60 border-t pt-3">
              {freshness && (
                // Ancho: el texto con la barra; angosto: el reloj (o la llama) en la columna de íconos, en el mismo lugar.
                <div className="relative">
                  <div className="rail-label">
                    <OfferFreshness freshness={freshness} collapsed={false} />
                  </div>
                  <div className="rail-icon absolute top-0 left-0.5">
                    <OfferFreshness freshness={freshness} collapsed />
                  </div>
                </div>
              )}
              {/* Ancho: el botón de tema a la derecha de la cuenta; angosto, sobre ella. Siempre en el mismo sitio del DOM:
              sube o baja con transform y la cuenta cede el lugar con el relleno, así no salta al plegar el riel. */}
              <div className={cn("t-rail-foot relative", !wide && "pt-11")}>
                <div className={cn("t-rail-account flex h-12 items-center", wide && "pr-12")}>
                  <div className="w-full min-w-0">
                    <UserMenu
                      align="start"
                      side={wide ? "top" : "right"}
                      railLabel
                      loginClassName="h-9 w-full justify-start gap-2 overflow-hidden rounded-xl px-2.5"
                    />
                  </div>
                </div>
                <div
                  className={cn(
                    "absolute top-0 right-0 transition-transform duration-base ease-in-out motion-reduce:transition-none",
                    wide ? "translate-y-1.5" : "-translate-x-0.5",
                  )}
                >
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </aside>

          {/* Sólo escritorio: en teléfono los filtros siguen siendo la hoja del botón Filtros. */}
          {shownCatalog && <FiltersAside open={inCategory && panelOpen} data={shownCatalog} />}
        </>
      )}
      {/* Sin riel, los enlaces a las categorías (los que sigue un rastreador móvil) no estarían en el HTML: van aquí,
          fuera de la vista; a la vista están en la hoja "Categorías". */}
      {!showDesktop && (
        <nav aria-label="Categorías" className="sr-only">
          {categories.map((c) => (
            <Link key={c.id} to={`/categoria/${c.slug}`} prefetch="none" tabIndex={-1}>
              {CATEGORY_NAV_LABELS[c.id]}
            </Link>
          ))}
        </nav>
      )}

      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-border/60 border-b bg-background/85 px-3 backdrop-blur-md lg:hidden">
        <Brand compact />
        <SearchField className="flex-1" />
        <ThemeToggle />
        <UserMenu />
      </header>

      <nav
        aria-label="Atajos"
        className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-4 border-border/60 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
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
        <QuotesTab />
      </nav>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        {/* Hoja que sube desde abajo (transitions.dev, "panel reveal"): se desliza en vez de crecer desde el centro. */}
        <DialogContent className="top-auto bottom-0 max-h-[80dvh] w-full max-w-none translate-y-0 overflow-y-auto rounded-t-3xl rounded-b-none border-x-0 border-b-0 p-3 pb-8 zoom-in-100 zoom-out-100 slide-in-from-bottom-24 slide-out-to-bottom-24 lg:hidden">
          <DialogTitle className="px-2.5 pt-2 pb-3">Categorías</DialogTitle>
          {categories.map((c) => (
            <RailLink
              key={c.id}
              to={`/categoria/${c.slug}`}
              label={CATEGORY_NAV_LABELS[c.id]}
              count={c.productCount}
              large
              onClick={() => setSheetOpen(false)}
              icon={<CategoryIcon category={c.id} className="size-5" />}
            />
          ))}
        </DialogContent>
      </Dialog>
    </RailTarget>
  );
}
