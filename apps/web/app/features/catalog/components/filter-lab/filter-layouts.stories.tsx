import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  IconAdjustmentsHorizontal,
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { CategoryIcon } from "~/features/category/components/category-icon";
import { Pagination, ProductGrid } from "~/features/explore/components";
import { Logo } from "~/shared/components/layout/logo";
import { Button } from "~/shared/components/primitives/button";
import { Dialog, DialogContent, DialogTitle } from "~/shared/components/primitives/dialog";
import { cn } from "~/shared/lib/utils";
import { categories } from "~/shared/storybook/fixtures";
import { type Lab, type Selection, useLab } from "./lab-data";
import { Chips, FilterBody, Relax, ResultCount, Toolbar } from "./lab-parts";

const meta = {
  title: "Catálogo/Exploración de filtros",
  id: "filtros-lab",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Estado de arranque de las tres: con algo aplicado, para ver chips, conteos y valores apagados. */
const START: Partial<Selection> = {
  groups: { brand: [], maker: [], chip: [], vram: ["16 GB"], memory: [], pcie: [] },
};

function Results({ lab, className }: { lab: Lab; className?: string }) {
  if (lab.total === 0) return <Relax lab={lab} />;
  return (
    <>
      <ProductGrid
        key={lab.pageItems.map((p) => p.id).join()}
        products={lab.pageItems}
        className={cn("t-results", className)}
      />
      <Pagination
        className="mt-6"
        currentPage={lab.page}
        totalPages={lab.totalPages}
        onPageChange={(p) => {
          lab.setPage(p);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </>
  );
}

function Title({ lab }: { lab: Lab }) {
  return (
    <div className="flex items-baseline gap-3">
      <h1 className="font-semibold text-2xl tracking-tight">Tarjetas de video</h1>
      <ResultCount lab={lab} />
    </div>
  );
}

/** Hoja de filtros: abajo en teléfono, a la derecha en el panel completo de C. Mismo cuerpo que el resto. */
function FilterSheet({
  lab,
  open,
  onOpenChange,
  side,
}: {
  lab: Lab;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: "bottom" | "right";
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "overflow-hidden p-0",
          side === "bottom"
            ? "top-auto bottom-0 max-h-[85dvh] w-full max-w-none translate-y-0 rounded-t-3xl rounded-b-none border-x-0 border-b-0 zoom-in-100 zoom-out-100 slide-in-from-bottom-24 slide-out-to-bottom-24"
            : "top-0 right-0 left-auto h-dvh max-h-none w-[26rem] max-w-full translate-x-0 translate-y-0 rounded-l-3xl rounded-r-none border-y-0 border-r-0 zoom-in-100 zoom-out-100 slide-in-from-right-24 slide-out-to-right-24",
        )}
      >
        <DialogTitle className="px-5 pt-5 pb-2">Filtros</DialogTitle>
        {/* El dialog envuelve el contenido en un div sin alto: el scroll lleva su tope y el pie queda siempre a la vista. */}
        <div
          className={cn(
            "scrollbar-slim overflow-y-auto overflow-x-hidden px-3",
            side === "bottom" ? "max-h-[calc(85dvh-9.5rem)]" : "h-[calc(100dvh-9.5rem)]",
          )}
        >
          <Chips lab={lab} className="px-2 pb-3" />
          <FilterBody lab={lab} inline />
        </div>
        <div className="flex gap-2 border-border/60 border-t p-4">
          <Button variant="outline" className="h-10 flex-1" onClick={lab.clear} disabled={lab.chips.length === 0}>
            Limpiar
          </Button>
          <Button className="h-10 flex-[2]" onClick={() => onOpenChange(false)}>
            Ver {lab.total} {lab.total === 1 ? "producto" : "productos"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** En teléfono los tres comparten el mismo gesto: un botón que abre la hoja de abajo. */
function MobileFilterButton({ lab }: { lab: Lab }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" className="lg:hidden" onClick={() => setOpen(true)}>
        <IconAdjustmentsHorizontal />
        Filtros{lab.chips.length > 0 && ` (${lab.chips.length})`}
      </Button>
      <FilterSheet lab={lab} open={open} onOpenChange={setOpen} side="bottom" />
    </>
  );
}

/** Riel plegado a íconos, igual que el real: sirve de marco para B y C. */
function IconRail() {
  return (
    <aside className="sticky top-0 hidden h-screen w-16 shrink-0 flex-col items-center gap-2 border-border/60 border-r bg-card/40 py-3 lg:flex">
      <Logo className="mb-3 size-6" />
      {categories.map((c) => (
        <span
          key={c.id}
          className={cn(
            "grid size-9 place-items-center rounded-xl text-foreground/65",
            c.id === "gpu" && "bg-secondary text-foreground",
          )}
        >
          <CategoryIcon category={c.id} />
        </span>
      ))}
    </aside>
  );
}

/* ───────────── A: el riel muta ───────────── */

const pane = "absolute inset-0 flex flex-col transition-[transform,opacity] duration-base ease-in-out";
type Mode = "filters" | "nav";

/** Aviso con la cantidad de filtros: en el riel ancho va en la fila, en el plegado sobre el ícono. */
const Badge = ({ n, className }: { n: number; className?: string }) => (
  <span
    className={cn(
      "grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground tabular-nums",
      className,
    )}
  >
    {n}
  </span>
);

/**
 * El riel de siempre, con una zona que muta: categorías o filtros de la categoría abierta. Plegado, el filtro es un
 * ícono con aviso que lo asoma por encima del contenido; `F` alterna, Ctrl+B pliega.
 */
function RailA({
  lab,
  mode,
  setMode,
  collapsed,
  setCollapsed,
}: {
  lab: Lab;
  mode: Mode;
  setMode: (m: Mode | ((m: Mode) => Mode)) => void;
  collapsed: boolean;
  setCollapsed: (c: boolean | ((c: boolean) => boolean)) => void;
}) {
  const [peek, setPeek] = useState(false);
  const wide = !collapsed || peek;
  const showFilters = mode === "filters" && wide;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if (e.key === "b" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setPeek(false);
        setCollapsed((c) => !c);
      } else if (e.key === "Escape") setPeek(false);
      else if (e.key === "f" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (collapsed) {
          setMode("filters");
          setPeek((p) => !p);
        } else setMode((m) => (m === "filters" ? "nav" : "filters"));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPeek(false);
          setCollapsed((c) => !c);
        }}
        aria-label={collapsed ? "Desplegar menú" : "Plegar menú"}
        className={cn(
          "t-rail-handle fixed top-8 left-0 z-50 hidden size-6 cursor-pointer place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground lg:grid",
          wide ? "[--rail:16rem]" : "[--rail:4rem]",
        )}
      >
        <span className="t-icon-swap">
          <IconChevronLeft data-on={wide} className="size-3.5" stroke={2} />
          <IconChevronRight data-on={!wide} className="size-3.5" stroke={2} />
        </span>
      </button>
      {/* Reserva el hueco del riel: asomarlo lo pone por encima del contenido sin moverlo. */}
      <div className={cn("t-resize hidden shrink-0 lg:block", collapsed ? "w-16" : "w-64")} />
      <aside
        data-wide={wide}
        onMouseLeave={() => setPeek(false)}
        className={cn(
          "t-resize fixed inset-y-0 left-0 z-40 hidden flex-col gap-4 overflow-hidden border-border/60 border-r bg-card/40 px-3 py-3 lg:flex",
          wide ? "w-64" : "w-16",
          peek && "bg-card shadow-2xl",
        )}
      >
        <div className="flex h-10 shrink-0 items-center gap-2 px-2">
          <Logo className="size-6 shrink-0" />
          <span className="rail-label font-semibold text-lg tracking-tight">framerate</span>
        </div>
        <div className="flex h-9 shrink-0 items-center gap-3 rounded-xl bg-secondary/50 px-2.5 text-muted-foreground text-sm">
          <IconSearch className="size-[18px] shrink-0" />
          <span className="rail-label">Buscar</span>
        </div>

        <div className="relative min-h-0 flex-1">
          <nav
            aria-label="Categorías"
            inert={showFilters}
            className={cn(pane, showFilters ? "-translate-x-6 opacity-0" : "translate-x-0 opacity-100")}
          >
            <p className="rail-label px-2.5 pb-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
              Categorías
            </p>
            <div className="flex flex-col gap-0.5">
              {categories.map((c) => {
                const active = c.id === "gpu";
                const n = active ? lab.chips.length : 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-label={c.label}
                    onClick={() => {
                      if (!active) return;
                      setMode("filters");
                      if (collapsed) setPeek(true);
                    }}
                    className={cn(
                      "flex h-9 items-center gap-3 rounded-xl px-2.5 text-sm transition-colors",
                      active ? "bg-secondary text-foreground" : "text-foreground/65 hover:bg-secondary/60",
                    )}
                  >
                    <span className="relative shrink-0">
                      <CategoryIcon category={c.id} />
                      {n > 0 && <Badge n={n} className="rail-icon absolute -top-1.5 -right-2" />}
                    </span>
                    <span className="rail-label flex-1 truncate text-left">{c.label}</span>
                    {n > 0 && <Badge n={n} className="rail-label" />}
                  </button>
                );
              })}
            </div>
          </nav>

          <section
            aria-label="Filtros de tarjetas de video"
            inert={!showFilters}
            className={cn(pane, showFilters ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0")}
          >
            <button
              type="button"
              onClick={() => setMode("nav")}
              className="flex h-9 shrink-0 items-center gap-2 rounded-xl px-2.5 text-muted-foreground text-sm transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              <IconArrowLeft className="size-4" />
              Categorías
              <kbd className="ml-auto rounded-md border border-border px-1.5 text-[11px]">F</kbd>
            </button>
            <div className="flex shrink-0 items-center gap-2 px-2.5 pt-2 pb-1">
              <CategoryIcon category="gpu" className="size-5" />
              <h2 className="font-semibold text-sm">Tarjetas de video</h2>
              <ResultCount lab={lab} className="ml-auto text-xs" />
            </div>
            {/* El desvanecido de abajo avisa que hay más grupos sin poner una barra de scroll gruesa. */}
            <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto overflow-x-hidden [mask-image:linear-gradient(to_bottom,black_calc(100%-24px),transparent)]">
              <FilterBody lab={lab} />
            </div>
            {lab.chips.length > 0 && (
              <div className="shrink-0 border-border/60 border-t pt-2">
                <Button variant="outline" className="w-full" onClick={lab.clear}>
                  Limpiar {lab.chips.length} {lab.chips.length === 1 ? "filtro" : "filtros"}
                </Button>
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}

function LayoutA({ initial = START, folded = false }: { initial?: Partial<Selection>; folded?: boolean }) {
  const lab = useLab(initial);
  const [mode, setMode] = useState<Mode>("filters");
  const [collapsed, setCollapsed] = useState(folded);
  // El sitio activa el movimiento completo en equipos holgados; aquí se activa para ver el riel crecer y encoger.
  useEffect(() => {
    document.documentElement.dataset.motion = "rich";
    return () => {
      delete document.documentElement.dataset.motion;
    };
  }, []);
  return (
    <div className="flex min-h-screen">
      <RailA lab={lab} mode={mode} setMode={setMode} collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-col gap-3 px-4 pt-4 lg:px-6 lg:pt-6">
          <Title lab={lab} />
          <Chips lab={lab} />
        </div>
        {/* El orden, la paginación y los filtros viven donde están las entradas; la barra queda fija al bajar. */}
        <Toolbar
          lab={lab}
          lead={<MobileFilterButton lab={lab} />}
          className="sticky top-0 z-20 mt-3 border-border/40 border-b bg-background/85 px-4 py-2.5 backdrop-blur-md lg:px-6"
        />
        <div className="p-4 pb-16 lg:p-6">
          <Results lab={lab} className="xl:grid-cols-3" />
        </div>
      </main>
    </div>
  );
}

/* ───────────── B: panel anidado en la vista ───────────── */

function LayoutB() {
  const lab = useLab(START);
  const [panel, setPanel] = useState(true);
  return (
    <div className="flex min-h-screen">
      <IconRail />
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 lg:p-6">
        <Title lab={lab} />
        <div className={cn("grid items-start gap-6", panel ? "lg:grid-cols-[17rem_1fr]" : "lg:grid-cols-1")}>
          {panel && (
            <aside
              aria-label="Filtros"
              className="scrollbar-slim sticky top-4 hidden max-h-[calc(100vh-2rem)] overflow-y-auto overflow-x-hidden rounded-2xl border border-border/60 bg-card/40 p-2 lg:block"
            >
              <FilterBody lab={lab} />
            </aside>
          )}
          <div className="flex min-w-0 flex-col gap-4">
            <Toolbar
              lab={lab}
              lead={
                <>
                  <Button variant="secondary" className="hidden lg:flex" onClick={() => setPanel((v) => !v)}>
                    <IconAdjustmentsHorizontal />
                    {panel ? "Ocultar filtros" : "Mostrar filtros"}
                  </Button>
                  <MobileFilterButton lab={lab} />
                </>
              }
            />
            <Chips lab={lab} />
            <Results lab={lab} className={panel ? "xl:grid-cols-2" : "xl:grid-cols-3"} />
          </div>
        </div>
      </main>
    </div>
  );
}

/* ───────────── C: barra rápida y panel completo ───────────── */

const chip = (on: boolean) =>
  cn(
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 font-medium text-sm transition-[color,background-color,scale] active:scale-[0.97]",
    on ? "bg-primary/10 text-primary" : "bg-secondary/50 text-secondary-foreground hover:bg-secondary",
  );

function LayoutC() {
  const lab = useLab(START);
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <IconRail />
      <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 lg:p-6">
        <Title lab={lab} />

        <div className="flex flex-col gap-3">
          {/* Compra por modelo: el atajo de Newegg. Un toque filtra; los que se quedan sin resultados se apagan. */}
          <div className="scrollbar-slim -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {lab.options("chip").map((o) => {
              const on = lab.sel.groups.chip.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  disabled={o.count === 0 && !on}
                  onClick={() => lab.toggle("chip", o.value)}
                  className={cn(chip(on), "disabled:pointer-events-none disabled:opacity-40")}
                >
                  {o.value}
                  <span className="text-muted-foreground text-xs tabular-nums">{o.count}</span>
                </button>
              );
            })}
          </div>

          <div className="sticky top-3 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/80 p-2 backdrop-blur-md">
            <Button className="h-9 rounded-full px-4" onClick={() => setOpen(true)}>
              <IconAdjustmentsHorizontal />
              Todos los filtros{lab.chips.length > 0 && ` (${lab.chips.length})`}
            </Button>
            {lab.options("vram").map((o) => {
              const on = lab.sel.groups.vram.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  disabled={o.count === 0 && !on}
                  onClick={() => lab.toggle("vram", o.value)}
                  className={cn(chip(on), "hidden disabled:pointer-events-none disabled:opacity-40 md:inline-flex")}
                >
                  {o.value}
                </button>
              );
            })}
          </div>
          <Chips lab={lab} />
        </div>

        <Toolbar lab={lab} />

        <Results lab={lab} className="xl:grid-cols-3" />
      </main>
      <FilterSheet lab={lab} open={open} onOpenChange={setOpen} side="right" />
    </div>
  );
}

export const A_ElRielMuta: Story = {
  name: "A: el riel muta",
  render: () => <LayoutA />,
};

export const A_RielPlegado: Story = {
  name: "A: riel plegado (clic en el ícono o F)",
  render: () => <LayoutA folded />,
};

export const A_SinResultados: Story = {
  name: "A: sin resultados, con salida",
  render: () => (
    <LayoutA
      initial={{
        groups: { brand: [], maker: [], chip: ["Arc B580"], vram: ["16 GB"], memory: [], pcie: [] },
      }}
    />
  ),
};

export const B_PanelAnidado: Story = {
  name: "B: panel anidado en la vista",
  render: () => <LayoutB />,
};

export const C_BarraYPanelCompleto: Story = {
  name: "C: barra rápida y panel completo",
  render: () => <LayoutC />,
};
