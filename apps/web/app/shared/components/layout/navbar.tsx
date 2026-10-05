import type { CategoryItem, Freshness } from "@framerate/contracts";
import {
  IconCategory,
  IconChevronLeft,
  IconChevronRight,
  IconHome,
  IconLayoutGrid,
  IconPlus,
  IconRosetteDiscount,
  IconSearch,
} from "@tabler/icons-react";
import { createContext, type ReactNode, use, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigation } from "react-router";
import { useUser } from "~/features/auth/hooks/useAuth";
import { CategoryIcon } from "~/features/category/components/category-icon";
import { CreateQuoteDialog } from "~/features/quote/components/create-quote-dialog";
import { focusSearchField, SearchField, startSearchSpotlight } from "~/features/search/components/search-field";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "../primitives/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";
import { Logo } from "./logo";
import { NavFps, OfferFreshness, TimeGradient } from "./nav-parts";
import { UserMenu } from "./user-menu";

const railLink = (current: boolean) =>
  cn(
    "relative flex h-9 items-center gap-3 rounded-xl px-2.5 text-sm transition-[color,background-color,scale] active:scale-[0.985]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    current ? "bg-secondary text-foreground" : "text-foreground/65 hover:bg-secondary/60 hover:text-foreground",
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
          onClick?.();
        }}
        aria-label={collapsed ? label : undefined}
        data-current={current}
        className={cn(railLink(current), large && "h-12")}
      >
        {icon}
        <span className="rail-label truncate">{label}</span>
        {count !== undefined && (
          <span className="rail-label ml-auto text-muted-foreground text-xs tabular-nums">{count}</span>
        )}
      </NavLink>
    </RailHint>
  );
}

/**
 * Entrada destacada de `/cyber`: tarjeta propia con el haz de luz del buscador (`.beam`, variante con los colores del
 * evento). Sin el logo de cyber.cl: es marca de la CCS y haría parecer que somos participante oficial. Es un enlace
 * directo hijo del riel, así la píldora de sección activa la mide igual que a los demás.
 */
function CyberLink({ collapsed, onClick }: { collapsed?: boolean; onClick?: () => void }) {
  const { target, select } = use(RailTarget);
  const current = target === "/cyber";
  return (
    <RailHint label="Cyber Monday" collapsed={!!collapsed}>
      <NavLink
        to="/cyber"
        prefetch="intent"
        onClick={(e) => {
          if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) select("/cyber");
          onClick?.();
        }}
        aria-label={collapsed ? "Cyber Monday" : undefined}
        data-current={current}
        className={cn(
          "relative flex items-center gap-3 overflow-hidden rounded-xl border border-border/70 transition-[color,background-color,scale] active:scale-[0.985]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          current ? "bg-secondary" : "bg-card/60 hover:bg-secondary/60",
          "h-14 w-full px-2.5",
        )}
      >
        <span aria-hidden="true" data-variant="cyber" className="beam pointer-events-none absolute inset-0 rounded-xl">
          <span className="beam-glow" />
          <span className="beam-line" />
          <span className="beam-line beam-top" />
        </span>
        <IconRosetteDiscount className="size-[18px] shrink-0 text-[#2c65ef] dark:text-[#6b93f5]" stroke={1.75} />
        <span className="rail-label flex min-w-0 flex-col">
          <span className="truncate font-bold text-foreground text-sm tracking-tight">Cyber Monday</span>
          <span className="truncate text-muted-foreground text-xs">5 al 7 de octubre</span>
        </span>
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
  freshness,
  initialCollapsed,
}: {
  categories: CategoryItem[];
  /** Sin dato (la API falló) no se muestra. */
  freshness?: Freshness;
  initialCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  // El hueco del contenido lo pone `data-rail` en el <html> (app.css): plegar no vuelve a renderizar la página.
  const onCollapsedChange = (next: boolean) => {
    setCollapsed(next);
    document.documentElement.dataset.rail = next ? "collapsed" : "open";
    // biome-ignore lint/suspicious/noDocumentCookie: preferencia de interfaz sin datos sensibles.
    document.cookie = `rail=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };
  const user = useUser();
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Asomarse: con el riel plegado, buscar lo abre por encima del contenido (sin moverlo ni cambiar la preferencia) y
  // se vuelve a plegar al salir del riel.
  const [peek, setPeek] = useState(false);
  const wide = !collapsed || peek;
  const { pathname } = useLocation();
  const pendingPath = useNavigation().location?.pathname;
  const [selected, setSelected] = useState<string | null>(null);
  // Cuando la URL llega (o la navegación se cancela) manda la navegación real.
  // biome-ignore lint/correctness/useExhaustiveDependencies: se limpia en cada cambio de página o de pendiente.
  useEffect(() => setSelected(null), [pathname, pendingPath]);
  const railTarget = { target: selected ?? pendingPath ?? pathname, select: setSelected };
  const railRef = useRef<HTMLDivElement>(null);
  // La píldora ocupa el ancho del riel por CSS (también mientras cambia); sólo se mide su posición vertical, que
  // plegar no cambia: se mide al navegar y nada más.
  const [indicator, setIndicator] = useState({ ready: false, animate: false, visible: false, y: 0, height: 0 });
  // biome-ignore lint/correctness/useExhaustiveDependencies: el destino cambia qué enlace está activo.
  useLayoutEffect(() => {
    const active = railRef.current?.querySelector<HTMLElement>('a[data-current="true"]');
    setIndicator((prev) =>
      active
        ? // La primera vez se ubica sin deslizarse.
          { ready: true, animate: prev.ready, visible: true, y: active.offsetTop, height: active.offsetHeight }
        : { ...prev, visible: false },
    );
  }, [railTarget.target]);

  // `/` o Ctrl+K enfocan el buscador desde cualquier parte; con el riel plegado, se asoma. Ctrl+B pliega y despliega. El campo existe siempre
  // (angosto sólo se recorta), así que el foco y el desenfoque de Ctrl+K son inmediatos.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      // Ctrl/Cmd+B pliega o despliega el riel (y cierra uno asomado). Sin preventDefault, Firefox abre los marcadores.
      if (e.key === "b" && (e.ctrlKey || e.metaKey) && window.matchMedia("(min-width: 64rem)").matches) {
        e.preventDefault();
        if (peek) {
          setPeek(false);
          (document.activeElement as HTMLElement | null)?.blur();
        } else onCollapsedChange(!collapsed);
        return;
      }
      const shortcut = e.key === "k" && (e.ctrlKey || e.metaKey);
      if (shortcut || (e.key === "/" && !typing)) {
        e.preventDefault();
        if (collapsed && window.matchMedia("(min-width: 64rem)").matches) setPeek(true);
        focusSearchField();
        if (shortcut) startSearchSpotlight();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Mismo alto y radio que el resto del riel; angosto sólo se ve el ícono, en la misma columna que los demás.
  const quoteButton = user && (
    <RailHint label={t("create_quote")} collapsed={!wide}>
      <CreateQuoteDialog
        trigger={
          <button
            type="button"
            aria-label={wide ? undefined : t("create_quote")}
            className="inline-flex h-9 w-full cursor-pointer items-center gap-2 overflow-hidden rounded-xl bg-foreground px-3 font-medium text-background text-sm transition-[opacity,scale] hover:opacity-85 active:scale-[0.97]"
          >
            <IconPlus className="size-4 shrink-0" stroke={2.25} />
            <span className="rail-label truncate">{t("create_quote")}</span>
          </button>
        }
      />
    </RailHint>
  );

  return (
    <RailTarget value={railTarget}>
      <TimeGradient />
      {/* Manija fuera del riel (que recorta su contenido): sigue su borde con transform, no con left. */}
      <button
        type="button"
        onClick={() => {
          setPeek(false);
          onCollapsedChange(!collapsed);
        }}
        aria-label={collapsed ? "Desplegar menú" : "Plegar menú"}
        aria-expanded={!collapsed}
        className={cn(
          "t-rail-handle fixed top-8 left-0 z-50 hidden size-6 cursor-pointer place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:grid",
          wide ? "[--rail:16rem]" : "[--rail:4rem]",
        )}
      >
        <span className="t-icon-swap">
          <IconChevronLeft data-on={wide} className="size-3.5" stroke={2} />
          <IconChevronRight data-on={!wide} className="size-3.5" stroke={2} />
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
          if (collapsed && (e.target as HTMLElement).matches("input[data-search-field]")) setPeek(true);
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPeek(false);
        }}
        className={cn(
          "t-resize fixed inset-y-0 left-0 z-40 hidden flex-col gap-4 overflow-x-hidden border-border/60 border-r bg-card/40 px-3 py-3 lg:flex",
          wide ? "w-64" : "w-16",
          peek && "bg-card shadow-2xl",
        )}
      >
        <div className="flex h-10 shrink-0 items-center gap-2 px-2">
          <Link to="/" prefetch="intent" className="flex shrink-0 items-center gap-2 text-foreground">
            <Logo className="size-6 shrink-0" />
            <span className="rail-label font-semibold text-lg tracking-tight">framerate</span>
          </Link>
          <NavFps className="rail-label ml-auto" />
        </div>

        <SearchField className="shrink-0" />

        {/* Una sola píldora detrás de los enlaces marca la sección activa y se desliza a la nueva al navegar. */}
        <div
          ref={railRef}
          data-ready={indicator.ready}
          className={cn(
            "relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden",
            "data-[ready=true]:[&_a[data-current=true]]:bg-transparent",
          )}
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
          </nav>

          <CyberLink collapsed={!wide} />

          <nav aria-label="Categorías" className="flex flex-col gap-0.5">
            {/* Angosto, el título cede su lugar a una línea en la columna de íconos. */}
            <div className="relative">
              <p className="rail-label px-2.5 pb-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                Categorías
              </p>
              <span aria-hidden="true" className="rail-icon absolute top-1/2 left-2 h-px w-6 bg-border" />
            </div>
            {categories.map((c) => (
              <RailLink
                key={c.id}
                to={`/categoria/${c.slug}`}
                label={c.label}
                count={c.productCount}
                collapsed={!wide}
                icon={<CategoryIcon category={c.id} />}
              />
            ))}
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
          {quoteButton}
          <UserMenu
            align="start"
            side={wide ? "top" : "right"}
            railLabel
            loginClassName="h-9 w-full justify-start gap-2 overflow-hidden rounded-xl px-2.5"
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
        className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-4 border-border/60 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <NavLink to="/" end prefetch="intent" className={({ isActive }) => tabClass(isActive)}>
          <IconHome className="size-5" stroke={1.75} />
          Inicio
        </NavLink>
        <NavLink to="/cyber" prefetch="intent" className={({ isActive }) => tabClass(isActive)}>
          {/* El destacado del evento también en el teléfono: la pastilla lleva el haz azul a rojo del riel. */}
          <span className="relative -my-1 grid h-7 w-11 place-items-center overflow-hidden rounded-full border border-border/70 bg-card/60">
            <span
              aria-hidden="true"
              data-variant="cyber"
              className="beam pointer-events-none absolute inset-0 rounded-full"
            >
              <span className="beam-glow" />
              <span className="beam-line" />
            </span>
            <IconRosetteDiscount className="relative size-[18px] text-[#2c65ef] dark:text-[#6b93f5]" stroke={1.75} />
          </span>
          Cyber
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
          <div className="px-1 pt-2 pb-3">
            <CyberLink onClick={() => setSheetOpen(false)} />
          </div>
          <DialogTitle className="px-2.5 pb-3">Categorías</DialogTitle>
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
    </RailTarget>
  );
}
