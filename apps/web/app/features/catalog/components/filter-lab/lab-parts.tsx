import { Popover } from "@base-ui/react/popover";
import { Slider } from "@base-ui/react/slider";
import { IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconSearch, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { GROUPS, type Lab, PER_PAGE, PRICE_MAX, PRICE_MIN, SORTS, type SortKey } from "./lab-data";

const SEARCH_FROM = 8;

/** Una fila de valor: caja, etiqueta y conteo. Sin resultados queda apagada, salvo que ya esté marcada. */
function Option({ label, count, on, onClick }: { label: string; count: number; on: boolean; onClick: () => void }) {
  const empty = count === 0 && !on;
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={empty}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1 text-left text-sm transition-colors",
        on ? "bg-primary/10 font-medium text-primary" : "hover:bg-secondary/60",
        empty && "pointer-events-none text-muted-foreground/50",
      )}
    >
      <span
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-md border transition-colors",
          on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
        )}
      >
        <IconCheck className={cn("size-3 transition-opacity", on ? "opacity-100" : "opacity-0")} stroke={3} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span
        key={count}
        className="text-muted-foreground text-xs tabular-nums fade-in-0 zoom-in-90 animate-in duration-fast"
      >
        {count}
      </span>
    </button>
  );
}

/** Valores del grupo con casilla y conteo: se pueden elegir varios y la lista queda abierta. Con muchos, se busca. */
function OptionList({ group, lab }: { group: (typeof GROUPS)[number]; lab: Lab }) {
  const [query, setQuery] = useState("");
  const selected = lab.sel.groups[group.key];
  const options = lab.options(group.key);
  const found = query ? options.filter((o) => o.value.toLowerCase().includes(query.toLowerCase())) : options;
  return (
    <div className="flex flex-col gap-0.5">
      {options.length > SEARCH_FROM && (
        <div className="relative mb-1">
          <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar ${group.label.toLowerCase()}`}
            aria-label={`Buscar ${group.label.toLowerCase()}`}
            className="h-8 w-full rounded-xl border border-border/60 bg-background pr-3 pl-8 text-sm outline-none focus:border-primary"
          />
        </div>
      )}
      <div className="scrollbar-slim flex max-h-64 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
        {found.length === 0 && <p className="px-2.5 py-1 text-muted-foreground text-xs">Sin coincidencias</p>}
        {found.map((o) => (
          <Option
            key={o.value}
            label={o.value}
            count={o.count}
            on={selected.includes(o.value)}
            onClick={() => lab.toggle(group.key, o.value)}
          />
        ))}
      </div>
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => lab.clearGroup(group.key)}
          className="mt-1 border-border/50 border-t px-2.5 pt-2 text-left text-muted-foreground text-xs transition-colors hover:text-foreground"
        >
          Borrar {selected.length === 1 ? "la selección" : `las ${selected.length} selecciones`}
        </button>
      )}
    </div>
  );
}

/** El campo cerrado: el nombre a la izquierda y, si hay algo elegido, un resumen ("ASUS +1") para no tener que abrirlo. */
function FieldFace({ group, selected }: { group: (typeof GROUPS)[number]; selected: string[] }) {
  return (
    <>
      <span className={cn("truncate", selected.length ? "text-foreground" : "text-muted-foreground")}>
        {group.label}
      </span>
      {selected.length > 0 && (
        <span className="ml-auto shrink-0 font-medium text-primary text-xs">
          {selected[0]}
          {selected.length > 1 && ` +${selected.length - 1}`}
        </span>
      )}
      <IconChevronDown className={cn("size-4 shrink-0 text-muted-foreground", selected.length === 0 && "ml-auto")} />
    </>
  );
}

const field = (active: boolean) =>
  cn(
    "flex h-9 w-full items-center gap-2 rounded-xl border bg-background px-3 text-left text-sm transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? "border-primary/40" : "border-border/60",
  );

/**
 * Un filtro como un campo: cerrado ocupa una sola fila. Abierto, la lista sale como flotante a la derecha del panel
 * (no empuja a los demás ni agranda el panel); en una hoja (`inline`), donde un flotante se recortaría, se despliega
 * debajo del campo.
 */
function Group({ group, lab, inline }: { group: (typeof GROUPS)[number]; lab: Lab; inline: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = lab.sel.groups[group.key];

  if (inline) {
    return (
      <div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={field(selected.length > 0)}
        >
          <FieldFace group={group} selected={selected} />
        </button>
        {open && (
          <div className="mt-1 rounded-2xl border border-border/60 bg-card/40 p-2 fade-in-0 animate-in duration-fast">
            <OptionList group={group} lab={lab} />
          </div>
        )}
      </div>
    );
  }

  return (
    <Popover.Root>
      <Popover.Trigger className={field(selected.length > 0)}>
        <FieldFace group={group} selected={selected} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="right" align="start" sideOffset={14} collisionPadding={8} className="isolate z-50">
          <Popover.Popup className="w-64 origin-(--transform-origin) rounded-2xl border border-border/60 bg-popover p-2 shadow-lg duration-fast ease-out data-closed:animate-out data-open:animate-in data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=right]:slide-in-from-left-2">
            <OptionList group={group} lab={lab} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Rango de precio con dos manillas, como SoloTodo. Se arrastra sobre un borrador y se aplica al soltar. */
function PriceGroup({ lab }: { lab: Lab }) {
  const [draft, setDraft] = useState<number[] | null>(null);
  const [lo, hi] = draft ?? [lab.sel.min ?? PRICE_MIN, lab.sel.max ?? PRICE_MAX];
  const thumb =
    "size-4 rounded-full border-2 border-primary bg-background shadow-sm outline-none transition-transform after:absolute after:-inset-2.5 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-dragging:scale-110";
  return (
    <section className="pb-2">
      <h3 className="flex h-8 items-center px-1 font-medium text-sm">Precio</h3>
      <div className="px-2">
        <Slider.Root
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={10_000}
          minStepsBetweenValues={1}
          value={[lo, hi]}
          onValueChange={(v) => setDraft(v as number[])}
          onValueCommitted={(v) => {
            const [a, b] = v as number[];
            setDraft(null);
            lab.setPrice(a <= PRICE_MIN ? null : a, b >= PRICE_MAX ? null : b);
          }}
        >
          <Slider.Control className="flex h-5 touch-none items-center select-none">
            <Slider.Track className="relative h-1 w-full rounded-full bg-border">
              <Slider.Indicator className="rounded-full bg-primary" />
              <Slider.Thumb index={0} getAriaLabel={() => "Precio mínimo"} className={thumb} />
              <Slider.Thumb index={1} getAriaLabel={() => "Precio máximo"} className={thumb} />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
        <div className="mt-2 flex justify-between text-muted-foreground text-xs tabular-nums">
          <span>{formatCLP(lo)}</span>
          <span>{formatCLP(hi)}</span>
        </div>
      </div>
    </section>
  );
}

/**
 * Cuerpo de filtros, el mismo en los tres layouts: lo que cambia es el contenedor. El precio es un slider y el resto,
 * campos que se abren; así el panel cabe entero sin scrollear.
 */
export function FilterBody({ lab, inline = false }: { lab: Lab; inline?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <PriceGroup lab={lab} />
      {GROUPS.map((g) => (
        <Group key={g.key} group={g} lab={lab} inline={inline} />
      ))}
    </div>
  );
}

/** Conteo de resultados: el número nuevo entra con un pop corto al filtrar. */
export function ResultCount({ lab, className }: { lab: Lab; className?: string }) {
  return (
    <p className={cn("text-muted-foreground text-sm", className)}>
      <span
        key={lab.total}
        className="inline-block font-medium text-foreground tabular-nums fade-in-0 zoom-in-90 animate-in duration-fast"
      >
        {lab.total}
      </span>{" "}
      {lab.total === 1 ? "producto" : "productos"}
    </p>
  );
}

/** Filtros aplicados, cada uno con su quitar. Sólo aparece cuando hay alguno. */
export function Chips({ lab, className }: { lab: Lab; className?: string }) {
  if (lab.chips.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {lab.chips.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={c.clear}
          className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-3 py-1 text-foreground text-xs transition-colors fade-in-0 zoom-in-90 animate-in duration-fast hover:bg-secondary"
        >
          {c.label}
          <IconX className="size-3 text-muted-foreground" />
        </button>
      ))}
      <button
        type="button"
        onClick={lab.clear}
        className="text-muted-foreground text-xs transition-colors hover:text-foreground"
      >
        Limpiar todo
      </button>
    </div>
  );
}

/** Sin resultados: no se deja al visitante a ciegas, se le dice qué filtro quitar y cuántos productos aparecen. */
export function Relax({ lab }: { lab: Lab }) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <div>
        <h3 className="mb-1 font-medium text-foreground text-lg">Ningún producto cumple todo</h3>
        <p className="text-muted-foreground text-sm">Con un filtro menos aparecen resultados.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {lab.relax.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={c.clear}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-secondary/50 px-3.5 text-sm transition-colors hover:bg-secondary"
          >
            Quitar {c.label}
            <span className="text-muted-foreground text-xs tabular-nums">
              {c.count} {c.count === 1 ? "producto" : "productos"}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={lab.clear}
        className="text-muted-foreground text-xs transition-colors hover:text-foreground"
      >
        Limpiar todo
      </button>
    </div>
  );
}

const pick =
  "h-9 appearance-none rounded-full bg-secondary/50 pr-8 pl-3.5 font-medium text-foreground text-sm outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring";

function Pick({ label, children, ...props }: { label: string } & React.ComponentProps<"select">) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select className={pick} {...props}>
        {children}
      </select>
      <IconChevronDown className="pointer-events-none absolute right-3 size-3.5 text-muted-foreground" />
    </label>
  );
}

/**
 * Barra de la lista, sobre las entradas: orden a la izquierda; cuántas por página, el tramo que se ve y las flechas a
 * la derecha (como SoloTodo). El paginador completo va abajo, al final de la grilla.
 */
export function Toolbar({ lab, lead, className }: { lab: Lab; lead?: React.ReactNode; className?: string }) {
  const from = lab.total === 0 ? 0 : (lab.page - 1) * lab.perPage + 1;
  const to = Math.min(lab.page * lab.perPage, lab.total);
  const arrow =
    "grid size-9 place-items-center rounded-full transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-30";
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}>
      {lead}
      <Pick label="Ordenar por" value={lab.sort} onChange={(e) => lab.setSort(e.target.value as SortKey)}>
        {Object.entries(SORTS).map(([key, o]) => (
          <option key={key} value={key}>
            {o.label}
          </option>
        ))}
      </Pick>
      <div className="ml-auto flex items-center gap-3 text-muted-foreground text-sm">
        <span className="hidden sm:inline">Por página</span>
        <Pick label="Productos por página" value={lab.perPage} onChange={(e) => lab.setPerPage(Number(e.target.value))}>
          {PER_PAGE.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Pick>
        <span className="hidden tabular-nums sm:inline">
          {from} a {to} de {lab.total}
        </span>
        <div className="flex">
          <button
            type="button"
            aria-label="Página anterior"
            disabled={lab.page <= 1}
            onClick={() => lab.setPage(lab.page - 1)}
            className={arrow}
          >
            <IconChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Página siguiente"
            disabled={lab.page >= lab.totalPages}
            onClick={() => lab.setPage(lab.page + 1)}
            className={arrow}
          >
            <IconChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
