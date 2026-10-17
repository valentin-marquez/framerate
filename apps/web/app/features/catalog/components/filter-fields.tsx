import { Popover } from "@base-ui/react/popover";
import { Slider } from "@base-ui/react/slider";
import { IconCheck, IconChevronDown, IconSearch, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";

export interface FieldOption {
  value: string;
  label: string;
  count: number;
}

const SEARCH_FROM = 8;

/** Una fila de valor: caja (círculo si se elige uno solo), etiqueta y conteo. Sin resultados queda apagada, salvo que ya esté marcada. */
function Option({
  option,
  on,
  single,
  onClick,
}: {
  option: FieldOption;
  on: boolean;
  single?: boolean;
  onClick: () => void;
}) {
  const empty = option.count === 0 && !on;
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={empty}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1 text-left transition-colors",
        on ? "bg-primary/10 text-label-sm text-primary" : "text-paragraph-sm hover:bg-secondary/60",
        empty && "pointer-events-none text-muted-foreground/50",
      )}
    >
      <span
        className={cn(
          "grid size-4 shrink-0 place-items-center border transition-colors",
          single ? "rounded-full" : "rounded-md",
          on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
        )}
      >
        <IconCheck className={cn("size-3 transition-opacity", on ? "opacity-100" : "opacity-0")} stroke={3} />
      </span>
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
      {/* El conteo nuevo entra con un pop corto al filtrar. */}
      <span
        key={option.count}
        className="text-muted-foreground text-paragraph-xs tabular-nums fade-in-0 zoom-in-90 animate-in duration-fast"
      >
        {option.count.toLocaleString("es-CL")}
      </span>
    </button>
  );
}

interface FieldProps {
  label: string;
  options: FieldOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  /** Nota al pie de la lista (los productos sin el dato, por ejemplo). */
  note?: string;
  /** Se elige un solo valor (un mínimo o un máximo): elegirlo cierra la lista. */
  single?: boolean;
}

/** Valores con casilla y conteo: se pueden elegir varios y la lista queda abierta. Con muchos, se busca. */
function OptionList({ label, options, selected, onToggle, onClear, note, single }: FieldProps) {
  const [query, setQuery] = useState("");
  const found = query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options;
  return (
    <div className="flex flex-col gap-0.5">
      {options.length > SEARCH_FROM && (
        <div className="relative mb-1">
          <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar ${label.toLowerCase()}`}
            aria-label={`Buscar ${label.toLowerCase()}`}
            className="h-8 w-full rounded-xl border border-border/60 bg-background pr-3 pl-8 text-paragraph-sm outline-none focus:border-primary"
          />
        </div>
      )}
      <div className="scrollbar-slim flex max-h-64 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
        {found.length === 0 && (
          <p className="px-2.5 py-1 text-muted-foreground text-paragraph-xs">
            {options.length === 0 ? "Sin opciones con estos filtros" : "Sin coincidencias"}
          </p>
        )}
        {found.map((o) => (
          <Option
            key={o.value}
            option={o}
            on={selected.includes(o.value)}
            single={single}
            onClick={() => onToggle(o.value)}
          />
        ))}
      </div>
      {note && <p className="px-2.5 pt-1.5 text-muted-foreground text-paragraph-xs">{note}</p>}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="mt-1 border-border/50 border-t px-2.5 pt-2 text-left text-muted-foreground text-paragraph-xs transition-colors hover:text-foreground"
        >
          Borrar {selected.length === 1 ? "la selección" : `las ${selected.length} selecciones`}
        </button>
      )}
    </div>
  );
}

/**
 * Nombre y flecha del campo, dentro del botón que lo abre. Vacío, el nombre va dentro, como un marcador. Con algo
 * elegido, sube a la línea del borde (con el fondo del campo que la interrumpe) y las etiquetas ocupan el campo: así
 * nunca se pisan. Se ancla arriba y no al centro, porque con varias filas de etiquetas el campo crece.
 */
function FieldCap({ label, filled }: { label: string; filled: boolean }) {
  return (
    <>
      <span
        className={cn(
          "pointer-events-none absolute top-0 left-2 max-w-[calc(100%-3rem)] origin-left truncate bg-background px-1 text-muted-foreground transition-[transform] duration-fast ease-out",
          filled ? "-translate-y-1/2 translate-x-1.5 scale-[0.8]" : "translate-y-[calc(1.125rem-50%)]",
        )}
      >
        {label}
      </span>
      <IconChevronDown className="pointer-events-none absolute top-2.5 right-3 size-4 text-muted-foreground" />
    </>
  );
}

/**
 * Lo elegido, una etiqueta por valor con su x para quitarlo sin abrir la lista. El contenedor deja pasar el clic al
 * botón del campo, que está debajo: sólo las x lo reciben.
 */
function SelectedChips({
  options,
  selected,
  onRemove,
}: Pick<FieldProps, "options" | "selected"> & { onRemove: (value: string) => void }) {
  return (
    <span className="pointer-events-none relative z-10 flex min-w-0 flex-1 flex-wrap gap-1 pr-6">
      {selected.map((value) => {
        const label = options.find((o) => o.value === value)?.label ?? value;
        return (
          <span
            key={value}
            className="inline-flex max-w-full items-center gap-0.5 rounded-lg bg-primary/10 py-0.5 pr-0.5 pl-2 text-label-xs text-primary"
          >
            <span className="truncate">{label}</span>
            <button
              type="button"
              aria-label={`Quitar ${label}`}
              onClick={() => onRemove(value)}
              className="pointer-events-auto grid size-4 shrink-0 cursor-pointer place-items-center rounded-md text-primary/70 transition-colors hover:bg-primary/15 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <IconX className="size-3" stroke={2.5} />
            </button>
          </span>
        );
      })}
    </span>
  );
}

const field = (active: boolean) =>
  cn(
    "relative flex min-h-9 w-full items-center gap-2 rounded-xl border bg-background px-3 text-left text-paragraph-sm transition-colors hover:border-foreground/30",
    active ? "border-primary/40 py-1.5" : "border-border/60",
  );

/** El botón que abre la lista cubre todo el campo; las etiquetas van encima, así no hay un botón dentro de otro. */
const trigger =
  "absolute inset-0 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Un filtro como un campo: cerrado ocupa una sola fila. Abierto, la lista sale como flotante a la derecha del panel
 * (no empuja a los demás ni agranda el panel); en una hoja (`inline`), donde un flotante se recortaría, se despliega
 * debajo del campo. `data-rail-popup` avisa al riel de que el foco sigue dentro de él.
 */
export function FilterField({ inline, ...given }: FieldProps & { inline?: boolean }) {
  const [open, setOpen] = useState(false);
  const props = given.single
    ? {
        ...given,
        onToggle: (value: string) => {
          given.onToggle(value);
          setOpen(false);
        },
      }
    : given;
  const active = props.selected.length > 0;

  const chips = <SelectedChips options={props.options} selected={props.selected} onRemove={given.onToggle} />;

  if (inline) {
    return (
      <div>
        <div className={field(active)}>
          <button
            type="button"
            aria-label={props.label}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={trigger}
          >
            <FieldCap label={props.label} filled={active} />
          </button>
          {chips}
        </div>
        {open && (
          <div className="mt-1 rounded-2xl border border-border/60 bg-card/40 p-2 fade-in-0 animate-in duration-fast">
            <OptionList {...props} />
          </div>
        )}
      </div>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className={field(active)}>
        <Popover.Trigger aria-label={props.label} className={trigger}>
          <FieldCap label={props.label} filled={active} />
        </Popover.Trigger>
        {chips}
      </div>
      <Popover.Portal>
        <Popover.Positioner side="right" align="start" sideOffset={14} collisionPadding={8} className="isolate z-50">
          <Popover.Popup
            data-rail-popup=""
            className="w-64 origin-(--transform-origin) rounded-2xl border border-border/60 bg-popover p-2 shadow-lg duration-fast ease-out data-closed:animate-out data-open:animate-in data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=right]:slide-in-from-left-2"
          >
            <OptionList {...props} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

const STEP = 10_000;

/** Rango de precio con dos manillas. Se arrastra sobre un borrador y se aplica al soltar, para no navegar en cada paso. */
export function PriceSlider({
  bounds,
  min,
  max,
  onCommit,
}: {
  /** Mínimo y máximo de la categoría. */
  bounds: { min: number; max: number };
  min: number | null;
  max: number | null;
  onCommit: (min: number | null, max: number | null) => void;
}) {
  const lo = Math.floor(bounds.min / STEP) * STEP;
  const hi = Math.ceil(bounds.max / STEP) * STEP;
  const [draft, setDraft] = useState<number[] | null>(null);
  const [from, to] = draft ?? [Math.max(min ?? lo, lo), Math.min(max ?? hi, hi)];
  const thumb =
    "size-4 rounded-full border-2 border-primary bg-background shadow-sm outline-none transition-transform after:absolute after:-inset-2.5 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-dragging:scale-110";
  return (
    <section className="pb-2">
      <h3 className="flex h-8 items-center px-1 text-label-sm">Precio</h3>
      <div className="px-2">
        <Slider.Root
          min={lo}
          max={hi}
          step={STEP}
          minStepsBetweenValues={1}
          value={[from, to]}
          onValueChange={(v) => setDraft(v as number[])}
          onValueCommitted={(v) => {
            const [a, b] = v as number[];
            setDraft(null);
            onCommit(a <= lo ? null : a, b >= hi ? null : b);
          }}
        >
          <Slider.Control className="flex h-5 touch-none select-none items-center">
            <Slider.Track className="relative h-1 w-full rounded-full bg-border">
              <Slider.Indicator className="rounded-full bg-primary" />
              <Slider.Thumb index={0} getAriaLabel={() => "Precio mínimo"} className={thumb} />
              <Slider.Thumb index={1} getAriaLabel={() => "Precio máximo"} className={thumb} />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
        <div className="mt-2 flex justify-between text-muted-foreground text-paragraph-xs tabular-nums">
          <span>{formatCLP(from)}</span>
          <span>{formatCLP(to)}</span>
        </div>
      </div>
    </section>
  );
}
