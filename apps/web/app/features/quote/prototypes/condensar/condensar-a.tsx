import { IconBuildingStore } from "@tabler/icons-react";
import { useId, useState } from "react";
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
import type { CondenseOptions } from "./fixtures";
import {
  applyLabel,
  contextText,
  OptionCard,
  recommendedOf,
  SHEET,
  SHIPPING_NOTE,
  StoreSplit,
  storesLabel,
} from "./piezas";

/** A: una tarjeta-radio por número de tiendas, la recomendada marcada, y debajo el reparto de la elegida. */
export function CondensarA({ data, defaultOpen }: { data: CondenseOptions; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [chosen, setChosen] = useState(() => recommendedOf(data).stores);
  const option = data.options.find((o) => o.stores === chosen && o.available) ?? recommendedOf(data);
  const name = useId();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconBuildingStore className="size-4" />
          Comprar en menos tiendas
        </Button>
      </DialogTrigger>
      <DialogContent className={`${SHEET} sm:max-w-xl`}>
        <div className="space-y-4 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Comprar en menos tiendas</DialogTitle>
            <DialogDescription>{contextText(data)}</DialogDescription>
          </DialogHeader>

          <fieldset className="space-y-2">
            <legend className="sr-only">Número de tiendas</legend>
            {data.options.map((o) => (
              <OptionCard
                key={o.stores}
                option={o}
                name={name}
                checked={o.stores === option.stores}
                onSelect={() => setChosen(o.stores)}
              />
            ))}
          </fieldset>

          <section className="space-y-2">
            <h3 className="text-foreground text-label-sm">Así queda en {storesLabel(option.stores)}</h3>
            <StoreSplit option={option} />
            <p className="text-muted-foreground text-paragraph-xs">{SHIPPING_NOTE}</p>
          </section>
        </div>

        <DialogFooter className="sticky bottom-0 gap-2 sm:space-x-0 border-border border-t bg-card p-4 sm:px-6">
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
