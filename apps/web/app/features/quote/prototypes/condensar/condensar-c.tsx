import { IconBuildingStore, IconChevronDown, IconPackage } from "@tabler/icons-react";
import { Fragment, useId, useState } from "react";
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
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import type { CondenseOption, CondenseOptions } from "./fixtures";
import {
  applyLabel,
  contextText,
  OptionCard,
  recommendedOf,
  SHEET,
  SHIPPING_NOTE,
  StoreHead,
  StoreItems,
  storesLabel,
} from "./piezas";

/** Los tres perfiles; si dos caen en la misma opción, queda el primero. */
function profilesOf(data: CondenseOptions) {
  const available = data.options.filter((o) => o.available);
  const all = [
    { label: "Más barato", option: available.at(-1) as CondenseOption },
    { label: "Equilibrado", option: recommendedOf(data) },
    { label: "Menos tiendas", option: available[0] as CondenseOption },
  ];
  return all.filter((p, i) => all.findIndex((q) => q.option.stores === p.option.stores) === i);
}

/** C: pestañas con nombre (Kayak, Google Flights) y el reparto como tramos por tienda (Rome2Rio). */
export function CondensarC({ data, defaultOpen }: { data: CondenseOptions; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [chosen, setChosen] = useState(() => recommendedOf(data).stores);
  const [showAll, setShowAll] = useState(false);
  const profiles = profilesOf(data);
  const option = data.options.find((o) => o.stores === chosen) ?? recommendedOf(data);
  const others = data.options.length - profiles.length;
  const name = useId();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconBuildingStore className="size-4" />
          Comprar en menos tiendas
        </Button>
      </DialogTrigger>
      <DialogContent className={`${SHEET} sm:max-w-2xl`}>
        <div className="space-y-4 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Comprar en menos tiendas</DialogTitle>
            <DialogDescription>{contextText(data)}</DialogDescription>
          </DialogHeader>

          <div role="tablist" aria-label="Perfil de compra" className="grid auto-cols-fr grid-flow-col gap-2">
            {profiles.map((p) => {
              const active = p.option.stores === option.stores;
              return (
                <button
                  key={p.label}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setChosen(p.option.stores)}
                  className={cn(
                    "min-w-0 cursor-pointer rounded-2xl border border-border bg-background p-3 text-left transition-colors hover:bg-secondary/40",
                    active && "border-foreground/40 bg-secondary/40",
                  )}
                >
                  <span className="block truncate text-foreground text-label-sm">{p.label}</span>
                  <span className="block truncate text-foreground text-label-md tabular-nums sm:text-label-lg">
                    {formatCLP(p.option.totalCash)}
                  </span>
                  <span className="block truncate text-muted-foreground text-paragraph-xs">
                    {storesLabel(p.option.stores)}
                    {p.option.extraCash > 0 && (
                      <span className="max-sm:hidden">, +{formatCLP(p.option.extraCash)}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {others > 0 && (
            <div>
              <button
                type="button"
                aria-expanded={showAll}
                onClick={() => setShowAll((v) => !v)}
                className="flex cursor-pointer items-center gap-1 text-label-sm text-muted-foreground hover:text-foreground"
              >
                {showAll ? "Ocultar opciones" : "Ver todas las opciones"}
                <IconChevronDown className={cn("size-4 transition-transform", showAll && "rotate-180")} />
              </button>
              {showAll && (
                <fieldset className="mt-2 space-y-2">
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
              )}
            </div>
          )}

          <Route option={option} />
          <p className="text-muted-foreground text-paragraph-xs">{SHIPPING_NOTE}</p>
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

/** Un tramo por tienda sobre una línea vertical; entre tramos, el aviso de que es otro pedido. */
function Route({ option }: { option: CondenseOption }) {
  return (
    <ol>
      {option.split.map((split, i) => (
        <Fragment key={split.store.slug}>
          {i > 0 && (
            <li className="flex items-center gap-3 py-2 pl-4 text-muted-foreground text-paragraph-xs">
              <span className="h-6 border-border border-l-2 border-dashed" />
              <IconPackage className="size-4" />
              Otro pedido, con su propio envío
            </li>
          )}
          <li className="relative rounded-2xl border border-border bg-background p-3 pl-5">
            <span className="absolute top-3 bottom-3 left-2 w-1 rounded-full bg-foreground/15" />
            <StoreHead split={split} />
            <div className="mt-1">
              <StoreItems split={split} />
            </div>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
