import { IconBuildingStore } from "@tabler/icons-react";
import { useId, useState } from "react";
import { Button } from "~/shared/components/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "~/shared/components/primitives/dialog";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import type { CondenseOption, CondenseOptions } from "./fixtures";
import {
  applyLabel,
  contextText,
  extraLabel,
  OptionCard,
  recommendedOf,
  SHIPPING_NOTE,
  StoreSplit,
  storesLabel,
} from "./piezas";

/**
 * B: una sección de la página, no un diálogo. Desde tablet, control segmentado con las opciones y el reparto debajo;
 * en teléfono, un chip que abre la lista en una hoja inferior. El cambio de uno a otro es CSS, sin `matchMedia`.
 */
export function CondensarB({ data }: { data: CondenseOptions }) {
  const recommended = recommendedOf(data);
  const [chosen, setChosen] = useState(recommended.stores);
  const [dismissed, setDismissed] = useState(false);
  const [sheet, setSheet] = useState(false);
  const option = data.options.find((o) => o.stores === chosen && o.available) ?? recommended;
  const name = useId();
  const current = option.extraCash === 0;

  return (
    <>
      {dismissed ? (
        <Button variant="ghost" size="sm" className="max-md:hidden" onClick={() => setDismissed(false)}>
          <IconBuildingStore className="size-4" />
          Comprar en menos tiendas
        </Button>
      ) : (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-4 max-md:hidden">
          <div>
            <h2 className="text-foreground text-label-lg">Comprar en menos tiendas</h2>
            <p className="text-muted-foreground text-paragraph-sm">
              {contextText(data)}. Elige en cuántas quieres comprar y te mostramos dónde va cada componente.
            </p>
          </div>

          <fieldset className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-secondary/60 p-1">
            <legend className="sr-only">Número de tiendas</legend>
            {data.options.map((o) => (
              <Segment
                key={o.stores}
                option={o}
                name={name}
                checked={o.stores === option.stores}
                onSelect={() => setChosen(o.stores)}
              />
            ))}
          </fieldset>

          <StoreSplit option={option} columns />

          <div className="flex flex-wrap items-center justify-between gap-3 border-border border-t pt-3">
            <p className="text-muted-foreground text-paragraph-xs">{SHIPPING_NOTE}</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDismissed(true)}>
                Descartar
              </Button>
              <Button disabled={current}>{current ? "Ya compras así" : applyLabel(option)}</Button>
            </div>
          </div>
        </section>
      )}

      <div className="md:hidden">
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => setSheet(true)}>
          <IconBuildingStore className="size-4" />
          Comprar en menos tiendas
          <span className="text-muted-foreground tabular-nums">
            {storesLabel(recommended.stores)}, {extraLabel(recommended)}
          </span>
        </Button>
        <Dialog open={sheet} onOpenChange={setSheet}>
          <DialogContent className="top-auto bottom-0 max-h-[85dvh] w-full max-w-none translate-y-0 overflow-y-auto rounded-t-3xl rounded-b-none border-x-0 border-b-0 bg-card p-0 zoom-in-100 zoom-out-100 slide-in-from-bottom-24 slide-out-to-bottom-24">
            <div className="space-y-3 p-4">
              <div>
                <DialogTitle>Comprar en menos tiendas</DialogTitle>
                <DialogDescription>{contextText(data)}</DialogDescription>
              </div>
              <fieldset className="space-y-2">
                <legend className="sr-only">Número de tiendas</legend>
                {data.options.map((o) => (
                  <OptionCard
                    key={o.stores}
                    option={o}
                    name={`${name}-hoja`}
                    checked={o.stores === option.stores}
                    onSelect={() => setChosen(o.stores)}
                  />
                ))}
              </fieldset>
              <p className="text-muted-foreground text-paragraph-xs">{SHIPPING_NOTE}</p>
            </div>
            <DialogFooter className="sticky bottom-0 gap-2 border-border border-t bg-card p-4">
              <Button variant="ghost" className="h-10" onClick={() => setSheet(false)}>
                Cancelar
              </Button>
              <Button className="h-10" disabled={current} onClick={() => setSheet(false)}>
                {current ? "Ya compras así" : applyLabel(option)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

/** Un segmento: "N tiendas" y su diferencia en línea, como el "-20%" del segmentado de Origin UI. */
function Segment({
  option,
  name,
  checked,
  onSelect,
}: {
  option: CondenseOption;
  name: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col items-center justify-start rounded-xl px-2 py-2 text-center transition-colors",
        "hover:bg-background/60 has-checked:bg-background has-checked:shadow-xs has-focus-visible:ring-2 has-focus-visible:ring-ring/50",
        "has-disabled:cursor-not-allowed has-disabled:opacity-50 has-disabled:hover:bg-transparent",
      )}
    >
      <input
        type="radio"
        name={name}
        className="sr-only"
        checked={checked}
        disabled={!option.available}
        onChange={onSelect}
      />
      <span className="text-foreground text-label-sm">{storesLabel(option.stores)}</span>
      <span
        className={cn(
          "text-label-xs tabular-nums",
          option.extraCash === 0 && option.available ? "text-success" : "text-muted-foreground",
        )}
      >
        {option.available ? extraLabel(option) : "No disponible"}
      </span>
      {option.available && (
        <span className="text-muted-foreground text-paragraph-xs tabular-nums">{formatCLP(option.totalCash)}</span>
      )}
      {option.recommended && (
        <span className="mt-1 rounded-full bg-secondary px-2 py-0.5 text-label-xs text-foreground">Recomendada</span>
      )}
    </label>
  );
}
