import { IconBuildingStore } from "@tabler/icons-react";
import { type ComponentType, useEffect, useId, useRef, useState } from "react";
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
import { StoreLogo } from "~/shared/components/store-logo";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import type { CondenseOption, CondenseOptions } from "./fixtures";
import {
  applyLabel,
  byStoresDesc,
  contextText,
  extraLabel,
  extraShort,
  recommendedOf,
  SHEET,
  StoreDots,
  StoreRoute,
  storesLabel,
} from "./piezas";

interface Preset {
  label: string;
  option: CondenseOption;
}

/** Los tres atajos; si dos caen en la misma opción, queda el primero. */
function presetsOf(data: CondenseOptions): Preset[] {
  const available = data.options.filter((o) => o.available);
  const all = [
    { label: "Más barato", option: available.at(-1) as CondenseOption },
    { label: "Equilibrado", option: recommendedOf(data) },
    { label: "Menos tiendas", option: available[0] as CondenseOption },
  ];
  return all.filter((p, i) => all.findIndex((q) => q.option.stores === p.option.stores) === i);
}

const presetOf = (presets: Preset[], stores: number) => presets.find((p) => p.option.stores === stores)?.label;

interface ControlProps {
  data: CondenseOptions;
  presets: Preset[];
  chosen: number;
  onChoose: (stores: number) => void;
}

/**
 * Los presets son atajos a paradas del control de abajo (Simyo). Una parada que no es preset deja los tres sin marcar:
 * marcar el más cercano como "personalizado" mostraría un total que no es el elegido.
 */
function CondensarCPulido({
  data,
  defaultOpen,
  Control,
}: {
  data: CondenseOptions;
  defaultOpen?: boolean;
  Control: ComponentType<ControlProps>;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [chosen, setChosen] = useState(() => recommendedOf(data).stores);
  const presets = presetsOf(data);
  const option = data.options.find((o) => o.stores === chosen && o.available) ?? recommendedOf(data);
  // `showModal` enfoca el primer botón ("Más barato") y su anillo parecía una selección: el foco va a la elegida.
  const presetsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() =>
      presetsRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus(),
    );
    return () => cancelAnimationFrame(id);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconBuildingStore className="size-4" />
          Comprar en menos tiendas
        </Button>
      </DialogTrigger>
      <DialogContent className={`${SHEET} sm:max-w-2xl`}>
        <div className="space-y-5 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Comprar en menos tiendas</DialogTitle>
            <DialogDescription>{contextText(data)}</DialogDescription>
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
                    <StoreDots used={p.option.stores} max={data.storesNow} />
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
            <Control data={data} presets={presets} chosen={option.stores} onChoose={setChosen} />
          </div>

          <StoreRoute option={option} />
        </div>

        <DialogFooter className="sticky bottom-0 gap-2 border-border border-t bg-card p-4 sm:space-x-0 sm:px-6">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={option.extraCash === 0} onClick={() => setOpen(false)}>
            {option.extraCash === 0 ? "Ya compras así" : applyLabel(option)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const stop =
  "cursor-pointer has-disabled:cursor-not-allowed has-focus-visible:[&_[data-mark]]:ring-2 has-focus-visible:[&_[data-mark]]:ring-ring/50";

/**
 * C1: riel de escalones (Simyo). Radios nativos para el teclado (las flechas recorren las paradas y saltan la no
 * disponible) y un riel que se arrastra: la perilla sigue al dedo sin transición y, al soltar o al tocar una parada o un
 * preset, se acomoda en la parada con `ease-in-out`. Relleno y perilla se mueven sólo con `transform` (scaleX y
 * translateX), y el riel no selecciona texto al arrastrar (`select-none`, `touch-none`).
 */
function Riel({ data, chosen, onChoose }: ControlProps) {
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
  const pos = drag ?? at / last;

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
      <div className="grid grid-cols-6">
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

      {/* El riel va del centro de la primera columna al de la última: 1/12 del ancho a cada lado. */}
      <div
        ref={track}
        aria-hidden
        className={cn("relative mx-[calc(100%/12)] h-8 touch-none", drag === null ? "cursor-grab" : "cursor-grabbing")}
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

      <div className="grid grid-cols-6">
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

/**
 * C2: una barra por número de tiendas (Google Flights). La altura es el extra con escala de raíz cuadrada: en lineal
 * +$564.670 deja a +$2.090 en menos de un píxel; con raíz las chicas se distinguen y el orden se mantiene. Cortar la
 * barra gigante también servía, pero mentía en la que más importa evitar.
 */
function Barras({ data, presets, chosen, onChoose }: ControlProps) {
  const name = useId();
  const options = byStoresDesc(data);
  const top = Math.sqrt(Math.max(...options.map((o) => (o.available ? o.extraCash : 0)), 1));
  return (
    <fieldset className="rounded-2xl border border-border bg-background pt-3 pb-2.5 sm:px-3">
      <legend className="sr-only">Número de tiendas</legend>
      <div className="grid grid-cols-6">
        {options.map((o) => {
          const checked = o.stores === chosen;
          const preset = presetOf(presets, o.stores);
          return (
            <label key={o.stores} className={cn("group flex flex-col items-center text-center", stop)}>
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={checked}
                disabled={!o.available}
                onChange={() => onChoose(o.stores)}
              />
              <span className="flex h-28 w-full flex-col items-center justify-end gap-1 border-border border-b px-0.5 sm:px-2">
                {o.available ? (
                  <>
                    <span
                      className={cn(
                        "text-label-xs tabular-nums",
                        checked ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <span className="sm:hidden">{extraShort(o)}</span>
                      <span className="max-sm:hidden">+{formatCLP(o.extraCash)}</span>
                    </span>
                    <span
                      data-mark
                      style={{ height: `${Math.max(4, (Math.sqrt(o.extraCash) / top) * 80)}px` }}
                      className={cn(
                        "w-full max-w-12 rounded-t-md transition-colors",
                        checked ? "bg-foreground" : "bg-foreground/15 group-hover:bg-foreground/25",
                      )}
                    />
                  </>
                ) : (
                  <span className="mb-1 text-label-xs text-muted-foreground">No disponible</span>
                )}
              </span>
              <span className={cn("mt-2 text-label-xs", checked ? "text-foreground" : "text-muted-foreground")}>
                {storesLabel(o.stores)}
              </span>
              {preset && <span className="text-muted-foreground text-paragraph-xs">{preset}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** C3: una fila por número de tiendas con la cadena de sus logos (Google Maps). En teléfono, tres logos y "+N". */
function Filas({ data, presets, chosen, onChoose }: ControlProps) {
  const name = useId();
  return (
    <fieldset className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
      <legend className="sr-only">Número de tiendas</legend>
      {byStoresDesc(data).map((o) => {
        const checked = o.stores === chosen;
        const preset = presetOf(presets, o.stores);
        const cut = o.split.length > 4;
        return (
          <label
            key={o.stores}
            className={cn(
              "relative flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-secondary/40",
              "has-checked:bg-secondary/40 has-focus-visible:bg-secondary/60",
              "has-disabled:cursor-not-allowed has-disabled:hover:bg-transparent",
            )}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={checked}
              disabled={!o.available}
              onChange={() => onChoose(o.stores)}
            />
            {checked && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-foreground" />}
            <span className="w-14 shrink-0">
              <span className={cn("block text-label-lg", o.available ? "text-foreground" : "text-muted-foreground")}>
                {o.stores}
              </span>
              <span className="block text-muted-foreground text-paragraph-xs">
                {o.stores === 1 ? "tienda" : "tiendas"}
              </span>
            </span>
            <span className="min-w-0 flex-1 space-y-1">
              {o.available ? (
                <span className="flex items-center gap-1">
                  {o.split.map((s, i) => (
                    <StoreLogo
                      key={s.store.slug}
                      store={s.store}
                      className={cn("size-6 rounded-md", cut && i >= 3 && "max-sm:hidden")}
                    />
                  ))}
                  {cut && (
                    <span className="flex h-6 items-center rounded-md bg-secondary px-1.5 text-label-xs text-muted-foreground sm:hidden">
                      +{o.split.length - 3}
                    </span>
                  )}
                </span>
              ) : (
                <span className="block text-muted-foreground text-paragraph-xs">{o.unavailableReason}</span>
              )}
              {preset && (
                <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-foreground text-label-xs">
                  {preset}
                </span>
              )}
            </span>
            <span className="shrink-0 text-right">
              {o.available ? (
                <>
                  <span className="block text-foreground text-label-md tabular-nums">{formatCLP(o.totalCash)}</span>
                  <span
                    className={cn(
                      "block text-label-xs tabular-nums",
                      o.extraCash === 0 ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {extraLabel(o)}
                  </span>
                </>
              ) : (
                <span className="text-label-xs text-muted-foreground">No disponible</span>
              )}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

type Props = { data: CondenseOptions; defaultOpen?: boolean };

export const CondensarC1 = (p: Props) => <CondensarCPulido {...p} Control={Riel} />;
export const CondensarC2 = (p: Props) => <CondensarCPulido {...p} Control={Barras} />;
export const CondensarC3 = (p: Props) => <CondensarCPulido {...p} Control={Filas} />;
