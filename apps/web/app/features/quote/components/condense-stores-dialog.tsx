import type { QuoteCondenseOption, QuoteCondenseOptions, QuoteDetail } from "@framerate/contracts";
import { IconBuildingStore, IconLoader2 } from "@tabler/icons-react";
import { useEffect, useId, useRef, useState } from "react";
import { useCondenseOptions } from "~/features/quote/hooks/useQuotes";
import { Button } from "~/shared/components/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/shared/components/primitives/dialog";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { StoreRoute } from "./condense-store-route";

type Quote = Pick<QuoteDetail, "id" | "items">;

interface CondenseStoresDialogProps {
  quote: Quote;
  /** Fija la oferta de cada ítem que cambia y deja la cotización al día. */
  onApply: (option: QuoteCondenseOption) => Promise<void>;
  defaultOpen?: boolean;
}

/** Diálogo en escritorio, hoja inferior en teléfono (mismas clases que la hoja de filtros). */
const SHEET =
  "scrollbar-slim max-h-[85dvh] overflow-y-auto bg-card p-0 max-sm:top-auto max-sm:bottom-0 max-sm:w-full max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-t-3xl max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:zoom-in-100 max-sm:zoom-out-100 max-sm:slide-in-from-bottom-24 max-sm:slide-out-to-bottom-24 sm:w-[calc(100%-2rem)] sm:rounded-3xl";

const TITLE = "Comprar en menos tiendas";
const storesLabel = (n: number) => (n === 1 ? "1 tienda" : `${n} tiendas`);
const extraLabel = (o: QuoteCondenseOption) => (o.extraCash === 0 ? "Lo más barato" : `+${formatCLP(o.extraCash)}`);
/** En teléfono la columna de un riel de seis no da para "+$564.670": se redondea a miles. */
const extraShort = (o: QuoteCondenseOption) =>
  o.extraCash < 1000 ? `+${formatCLP(o.extraCash)}` : `+$${Math.round(o.extraCash / 1000)} mil`;
const recommendedOf = (data: QuoteCondenseOptions) =>
  data.options.find((o) => o.recommended) ?? (data.options.at(-1) as QuoteCondenseOption);
/** De más tiendas a menos: de izquierda a derecha el extra sólo sube. */
const byStoresDesc = (data: QuoteCondenseOptions) => [...data.options].sort((a, b) => b.stores - a.stores);
/** Si la opción es justo la oferta con que cuenta hoy cada ítem. */
const isCurrent = (option: QuoteCondenseOption, quote: Quote) =>
  option.split.every((s) =>
    s.items.every((line) => quote.items.find((i) => i.id === line.itemId)?.offer?.id === line.listingId),
  );

interface Preset {
  label: string;
  option: QuoteCondenseOption;
}

/** Los tres atajos; si dos caen en la misma opción, queda el primero. */
function presetsOf(data: QuoteCondenseOptions): Preset[] {
  const available = data.options.filter((o) => o.available);
  const all = [
    { label: "Más barato", option: available.at(-1) as QuoteCondenseOption },
    { label: "Equilibrado", option: recommendedOf(data) },
    { label: "Menos tiendas", option: available[0] as QuoteCondenseOption },
  ];
  return all.filter((p, i) => all.findIndex((q) => q.option.stores === p.option.stores) === i);
}

/** Puntos llenos: las tiendas que usa la opción (el glifo de nivel de Fintual). */
function StoreDots({ used, max }: { used: number; max: number }) {
  return (
    <span aria-hidden className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: posiciones fijas
          key={i}
          className={cn("size-1.5 rounded-full", i < used ? "bg-foreground" : "bg-foreground/15")}
        />
      ))}
    </span>
  );
}

/** Opciones para comprar en menos tiendas (sin envíos), cada una con su costo; se aplica sólo al confirmar. */
export function CondenseStoresDialog({ quote, onApply, defaultOpen }: CondenseStoresDialogProps) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconBuildingStore className="size-4" />
          {TITLE}
        </Button>
      </DialogTrigger>
      <DialogContent className={`${SHEET} sm:max-w-2xl`}>
        {/* El contenido se monta al abrir y se desmonta al cerrar: las opciones salen de los precios de ese momento. */}
        <CondensePanel quote={quote} onApply={onApply} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

type PanelProps = Pick<CondenseStoresDialogProps, "quote" | "onApply"> & { onClose: () => void };

function CondensePanel(props: PanelProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useCondenseOptions(props.quote.id);
  if (data?.options.some((o) => o.available)) return <CondenseChooser {...props} data={data} />;
  return (
    <>
      <div className="space-y-5 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{TITLE}</DialogTitle>
          <DialogDescription>{isLoading ? t("quote_condense_loading") : t("quote_condense_error")}</DialogDescription>
        </DialogHeader>
        {isLoading && <IconLoader2 className="mx-auto size-5 animate-spin text-muted-foreground" />}
      </div>
      <DialogFooter className="border-border border-t p-4 sm:px-6">
        <Button variant="ghost" onClick={props.onClose}>
          {t("cancel")}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Los presets son atajos a paradas del riel (Simyo). Una parada que no es preset deja los tres sin marcar: marcar el
 * más cercano como "personalizado" mostraría un total que no es el elegido.
 */
function CondenseChooser({ quote, onApply, onClose, data }: PanelProps & { data: QuoteCondenseOptions }) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState(() => recommendedOf(data).stores);
  const [applying, setApplying] = useState(false);
  const presets = presetsOf(data);
  const option = data.options.find((o) => o.stores === chosen && o.available) ?? recommendedOf(data);
  const current = isCurrent(option, quote);
  const dots = Math.max(data.storesNow, ...data.options.map((o) => o.stores));
  // `showModal` enfoca el primer botón ("Más barato") y su anillo parecía una selección: el foco va a la elegida.
  const presetsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      presetsRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus(),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  const apply = async () => {
    setApplying(true);
    try {
      await onApply(option);
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <div className="space-y-5 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{TITLE}</DialogTitle>
          <DialogDescription>{`${data.itemCount} componentes, hoy en ${storesLabel(data.storesNow)}`}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div ref={presetsRef} className="grid grid-cols-3 gap-2">
            {presets.map((p) => {
              const active = p.option.stores === option.stores;
              return (
                <button
                  key={p.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setChosen(p.option.stores)}
                  className={cn(
                    "min-w-0 cursor-pointer space-y-1.5 rounded-2xl border border-border bg-background p-2.5 text-left transition-colors hover:bg-secondary/40 sm:p-3",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    active && "border-foreground/40 bg-secondary/40",
                  )}
                >
                  <StoreDots used={p.option.stores} max={dots} />
                  <span className="block">
                    <span className="block truncate text-label-xs text-muted-foreground">{p.label}</span>
                    <span className="block text-foreground text-label-sm tabular-nums sm:text-label-lg">
                      {formatCLP(p.option.totalCash)}
                    </span>
                    <span className="block truncate text-muted-foreground text-paragraph-xs">
                      {storesLabel(p.option.stores)}
                    </span>
                    <span
                      className={cn(
                        "block truncate text-label-xs tabular-nums",
                        p.option.extraCash === 0 ? "text-success" : "text-muted-foreground",
                      )}
                    >
                      {extraLabel(p.option)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <Riel data={data} chosen={option.stores} onChoose={setChosen} />
        </div>

        <StoreRoute option={option} />
      </div>

      <DialogFooter className="sticky bottom-0 gap-2 border-border border-t bg-card p-4 sm:space-x-0 sm:px-6">
        <Button variant="ghost" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button disabled={current || applying} onClick={apply}>
          {applying && <IconLoader2 className="size-4 animate-spin" />}
          {current
            ? "Ya compras así"
            : `Aplicar: comprar en ${storesLabel(option.stores)}, ${formatCLP(option.totalCash)}`}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Riel de escalones (Simyo). Radios nativos para el teclado (las flechas recorren las paradas y saltan la no
 * disponible) y un riel que se arrastra: la perilla sigue al dedo sin transición y, al soltar o al tocar una parada o un
 * preset, se acomoda en la parada con `ease-in-out`. Relleno y perilla se mueven sólo con `transform` (scaleX y
 * translateX), y el riel no selecciona texto al arrastrar (`select-none`, `touch-none`). Con una sola opción no hay riel.
 */
function Riel({
  data,
  chosen,
  onChoose,
}: {
  data: QuoteCondenseOptions;
  chosen: number;
  onChoose: (stores: number) => void;
}) {
  const name = useId();
  const options = byStoresDesc(data);
  const last = options.length - 1;
  const at = Math.max(
    0,
    options.findIndex((o) => o.stores === chosen),
  );
  const track = useRef<HTMLDivElement>(null);
  // Posición del dedo (0 a 1) mientras se arrastra; `null` en reposo, cuando manda la parada elegida.
  const [drag, setDrag] = useState<number | null>(null);
  const [moved, setMoved] = useState(false);
  if (last < 1) return null;
  const pos = drag ?? at / last;
  const columns = { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` };

  const ratioAt = (clientX: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box || box.width === 0) return pos;
    return Math.min(1, Math.max(0, (clientX - box.left) / box.width));
  };
  // La parada disponible más cercana: la no disponible no se puede elegir ni arrastrando.
  const nearest = (ratio: number) => {
    const target = ratio * last;
    return options
      .map((o, i) => ({ o, d: Math.abs(i - target) }))
      .filter((x) => x.o.available)
      .sort((a, b) => a.d - b.d)[0]?.o;
  };
  const follow = (clientX: number) => {
    const ratio = ratioAt(clientX);
    setDrag(ratio);
    const o = nearest(ratio);
    if (o && o.stores !== chosen) onChoose(o.stores);
  };

  // `overflow-x-clip`: la capa de la perilla mide lo que el riel y al trasladarse se sale; clip no crea scroll.
  return (
    <fieldset className="group select-none overflow-x-clip rounded-2xl border border-border bg-background pt-3 pb-2.5 sm:px-3">
      <legend className="sr-only">Número de tiendas</legend>
      <div className="grid" style={columns}>
        {options.map((o) => {
          const checked = o.stores === chosen;
          return (
            <label key={o.stores} className="cursor-pointer text-center has-disabled:cursor-not-allowed">
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={checked}
                disabled={!o.available}
                onChange={() => onChoose(o.stores)}
              />
              <span
                className={cn("text-label-xs transition-colors", checked ? "text-foreground" : "text-muted-foreground")}
                aria-hidden
              >
                <span className="sm:hidden">{o.stores}</span>
                <span className="max-sm:hidden">{storesLabel(o.stores)}</span>
              </span>
              <span className="sr-only">{storesLabel(o.stores)}</span>
            </label>
          );
        })}
      </div>

      {/* El riel va del centro de la primera columna al de la última: media columna a cada lado. */}
      <div
        ref={track}
        aria-hidden
        className={cn("relative h-8 touch-none", drag === null ? "cursor-grab" : "cursor-grabbing")}
        style={{ marginInline: `calc(100% / ${options.length * 2})` }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          setMoved(false);
          follow(e.clientX);
        }}
        onPointerMove={(e) => {
          if (drag === null) return;
          setMoved(true);
          follow(e.clientX);
        }}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-foreground/15" />
        <span
          className={cn(
            "absolute inset-x-0 top-1/2 h-1.5 origin-left rounded-full bg-foreground",
            drag !== null && moved ? "transition-none" : "transition-transform duration-base ease-in-out",
          )}
          style={{ transform: `translateY(-50%) scaleX(${pos})` }}
        />
        {options.map((o, i) => (
          <span
            key={o.stores}
            className={cn(
              "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors",
              !o.available
                ? "size-2 border border-foreground/30 border-dashed bg-background"
                : i <= at
                  ? "size-1 bg-background/80"
                  : "size-2 bg-foreground/30",
            )}
            style={{ left: `${(i / last) * 100}%` }}
          />
        ))}
        {/* Una capa del ancho del riel que se traslada su propio ancho por `pos`: translateX en % es relativo a sí misma. */}
        <span
          className={cn(
            "pointer-events-none absolute inset-0",
            drag !== null && moved ? "transition-none" : "transition-transform duration-base ease-in-out",
          )}
          style={{ transform: `translateX(${pos * 100}%)` }}
        >
          <span
            className={cn(
              "absolute top-1/2 left-0 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-background bg-foreground shadow-sm transition-transform",
              drag !== null && "scale-125",
              "group-has-[:focus-visible]:ring-2 group-has-[:focus-visible]:ring-ring/50",
            )}
          />
        </span>
      </div>

      <div className="grid" style={columns}>
        {options.map((o) => {
          const checked = o.stores === chosen;
          return (
            <button
              key={o.stores}
              type="button"
              tabIndex={-1}
              disabled={!o.available}
              onClick={() => onChoose(o.stores)}
              className={cn(
                "cursor-pointer text-center text-label-xs tabular-nums transition-colors disabled:cursor-not-allowed",
                checked ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {o.available ? (
                <>
                  <span className="sm:hidden">{extraShort(o)}</span>
                  <span className="max-sm:hidden">+{formatCLP(o.extraCash)}</span>
                </>
              ) : (
                "No disponible"
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
