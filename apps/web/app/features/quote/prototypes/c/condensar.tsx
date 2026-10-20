import { CONDENSE_STORE_VALUE, QUOTE_SLOT_LABELS, type QuoteDetail } from "@framerate/contracts";
import { IconBuildingStore } from "@tabler/icons-react";
import { useState } from "react";
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
import { Input } from "~/shared/components/primitives/input";
import { StoreLogo } from "~/shared/components/store-logo";
import { formatCLP } from "~/shared/utils/format";
import type { QuoteCondensePlan } from "../fixtures";

interface CondenseDialogProps {
  quote: Pick<QuoteDetail, "items">;
  plan: QuoteCondensePlan;
  defaultOpen?: boolean;
}

/**
 * "Condensar tiendas" como "Prices By Merchant": un bloque por tienda con su cobertura y subtotal, y en cada componente
 * cuánto más cuesta ahí que en la tienda más barata, en palabras.
 */
export function CondenseDialog({ quote, plan, defaultOpen }: CondenseDialogProps) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [storeValue, setStoreValue] = useState(String(CONDENSE_STORE_VALUE));
  const itemOf = (id: number) => quote.items.find((i) => i.id === id);
  // El ícono de la tienda sale de las ofertas de la cotización cuando alguna es de esa tienda.
  const iconOf = (slug: string) => quote.items.find((i) => i.offer?.store.slug === slug)?.offer?.store.iconUrl;
  const total = plan.stores.reduce((sum, s) => sum + s.subtotalCash, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <IconBuildingStore className="size-4" />
          Condensar tiendas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-3xl bg-card p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Condensar tiendas</DialogTitle>
          <DialogDescription>
            De {plan.storesBefore} tiendas a {plan.storesAfter}, por {formatCLP(plan.extraCash)} más que comprar cada
            pieza donde es más barata.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid gap-3 rounded-2xl bg-secondary/50 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-4">
          <div className="space-y-1.5">
            <label htmlFor="c-store-value" className="block text-foreground text-label-sm">
              Cuánto vale ahorrarse una tienda
            </label>
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-sm">$</span>
              <Input
                id="c-store-value"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                value={storeValue}
                onChange={(e) => setStoreValue(e.target.value)}
                className="w-32 text-right text-foreground tabular-nums"
              />
            </span>
            <span className="block text-muted-foreground text-paragraph-xs">
              El envío y el tiempo de una compra menos. Súbelo para juntar más tiendas, bájalo para cuidar el precio.
            </span>
          </div>
          <div className="sm:text-right">
            <span className="block text-muted-foreground text-label-xs">Total resultante</span>
            <span className="block text-foreground text-title-h5 tabular-nums">{formatCLP(total)}</span>
            <span className="block text-muted-foreground text-paragraph-xs tabular-nums">
              {formatCLP(plan.extraCash)} sobre lo más barato
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {plan.stores.map((store) => {
            const rows = plan.items.filter((i) => i.store.slug === store.slug);
            return (
              <section key={store.slug} className="overflow-hidden rounded-2xl border border-border">
                <header className="flex items-center gap-3 border-border border-b bg-secondary/30 px-3 py-2.5">
                  <StoreLogo
                    store={{ name: store.name, slug: store.slug, icon_url: iconOf(store.slug) }}
                    className="size-7 rounded-md text-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-foreground text-label-sm">{store.name}</h3>
                    <p className="text-muted-foreground text-paragraph-xs tabular-nums">
                      {store.itemIds.length} de {plan.items.length} componentes
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="block text-muted-foreground text-label-xs">Subtotal</span>
                    <span className="block text-foreground text-label-md tabular-nums">
                      {formatCLP(store.subtotalCash)}
                    </span>
                  </div>
                </header>
                <div className="hidden grid-cols-[8.5rem_minmax(0,1fr)_6.5rem_11rem] gap-3 border-border border-b px-3 py-1.5 text-muted-foreground text-label-xs md:grid">
                  <span>Componente</span>
                  <span>Producto</span>
                  <span className="text-right">Efectivo</span>
                  <span>Diferencia</span>
                </div>
                <ul className="divide-y divide-border">
                  {rows.map((row) => {
                    const item = itemOf(row.itemId);
                    const diff = row.priceCash - row.cheapestPriceCash;
                    return (
                      <li
                        key={row.itemId}
                        className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-3 py-2 md:grid-cols-[8.5rem_minmax(0,1fr)_6.5rem_11rem] md:items-center"
                      >
                        <span className="col-span-2 text-muted-foreground text-label-xs md:col-span-1">
                          {item ? QUOTE_SLOT_LABELS[item.slot] : ""}
                        </span>
                        <span className="col-span-2 truncate text-foreground text-label-sm md:col-span-1">
                          {item?.product.name}
                        </span>
                        <span className="text-foreground text-label-sm tabular-nums md:text-right">
                          {formatCLP(row.priceCash)}
                        </span>
                        <span className="text-right text-paragraph-xs md:text-left">
                          {diff > 0 ? (
                            <span className="text-warn">
                              {formatCLP(diff)} más que en {row.cheapestStore.name}
                            </span>
                          ) : (
                            <span className="text-success">El precio más bajo</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => setOpen(false)}>
            Aplicar: {plan.storesAfter} tiendas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
