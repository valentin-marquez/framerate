import { Slider } from "@base-ui/react/slider";
import { CONDENSE_STORE_VALUE, type QuoteCondensePlan, type QuoteDetail } from "@framerate/contracts";
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
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";

const MAX = 50_000;
const STEP = 1_000;
const thumb =
  "size-4 rounded-full border-2 border-primary bg-background shadow-sm outline-none transition-transform after:absolute after:-inset-2.5 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-dragging:scale-110";

interface Props {
  quote: Pick<QuoteDetail, "items" | "totals">;
  /** El plan que propone el servidor con el valor por defecto. */
  plan: QuoteCondensePlan;
  defaultOpen?: boolean;
  trigger?: React.ReactElement;
}

/**
 * En el prototipo hay un solo plan: conviene mientras lo que se ahorra en tiendas evitadas pague la diferencia. En la
 * página real el plan lo pide el servidor por cada valor.
 */
const worth = (plan: QuoteCondensePlan, value: number) =>
  plan.improves && value * (plan.storesBefore - plan.storesAfter) >= plan.extraCash;

export function VitrinaCondensar({ quote, plan, defaultOpen, trigger }: Props) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [value, setValue] = useState(CONDENSE_STORE_VALUE);
  const ok = worth(plan, value);
  const before = { stores: plan.storesBefore, total: quote.totals.cash };
  const after = ok ? { stores: plan.storesAfter, total: quote.totals.cash + plan.extraCash } : before;
  const name = (itemId: number) => quote.items.find((i) => i.id === itemId)?.product.name ?? "Componente";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <IconBuildingStore className="size-4" />
            Condensar tiendas
          </Button>
        )}
      </DialogTrigger>
      {/* En teléfono es una hoja de ancho completo pegada abajo. */}
      <DialogContent className="max-h-[90dvh] w-full overflow-y-auto bg-card sm:max-w-lg max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:m-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 rounded-3xl max-sm:rounded-b-none">
        <DialogHeader>
          <DialogTitle>Condensar tiendas</DialogTitle>
          <DialogDescription className="text-label-md text-foreground">
            {ok
              ? `Con ${formatCLP(value)} por tienda conviene comprar en ${plan.storesAfter} tiendas: pagas ${formatCLP(plan.extraCash)} más.`
              : `Con ${formatCLP(value)} por tienda conviene seguir en ${plan.storesBefore} tiendas, cada pieza donde es más barata.`}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            { label: "Ahora", ...before, active: !ok },
            { label: "Condensado", ...after, active: ok },
          ].map((side) => (
            <div
              key={side.label}
              className={cn(
                "space-y-1 rounded-2xl border p-4",
                side.active ? "border-foreground/20 bg-background" : "border-border",
              )}
            >
              <span className="text-label-xs text-muted-foreground">{side.label}</span>
              <p className="text-title-h6 text-foreground tabular-nums">{formatCLP(side.total)}</p>
              <p className="text-muted-foreground text-paragraph-xs">{side.stores} tiendas</p>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-3 rounded-2xl bg-secondary/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="b-condense-value" className="text-label-sm">
              Cuánto vale ahorrarte una tienda
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-sm">$</span>
              <Input
                id="b-condense-value"
                type="number"
                inputMode="numeric"
                min={0}
                step={STEP}
                value={value}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  setValue(Number.isFinite(n) && n >= 0 ? Math.min(n, 1_000_000) : 0);
                }}
                className="w-28 text-right text-foreground tabular-nums"
              />
            </div>
          </div>
          <Slider.Root
            min={0}
            max={MAX}
            step={STEP}
            value={Math.min(value, MAX)}
            onValueChange={(v) => setValue(v as number)}
          >
            <Slider.Control className="flex h-5 touch-none select-none items-center">
              <Slider.Track className="relative h-1 w-full rounded-full bg-border">
                <Slider.Indicator className="rounded-full bg-primary" />
                <Slider.Thumb getAriaLabel={() => "Valor por tienda"} className={thumb} />
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>
          <div className="flex justify-between text-muted-foreground text-paragraph-xs tabular-nums">
            <span>{formatCLP(0)}</span>
            <span>{formatCLP(MAX)}</span>
          </div>
          <p className="text-muted-foreground text-paragraph-xs">
            Es lo que vale para ti el envío y el tiempo de una compra menos.
          </p>
        </div>

        {ok && (
          <ul className="mt-4 space-y-3">
            {plan.stores.map((store) => (
              <li key={store.slug} className="overflow-hidden rounded-2xl border border-border">
                <div className="flex items-center gap-3 bg-secondary/30 px-4 py-3">
                  <StoreLogo store={store} className="size-6 rounded-md" />
                  <span className="min-w-0 flex-1 truncate text-label-sm">{store.name}</span>
                  <span className="text-label-sm tabular-nums">{formatCLP(store.subtotalCash)}</span>
                </div>
                <ul className="divide-y divide-border">
                  {plan.items
                    .filter((i) => i.store.slug === store.slug)
                    .map((i) => (
                      <li key={i.itemId} className="flex items-start gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-paragraph-sm">{name(i.itemId)}</span>
                          {i.priceCash > i.cheapestPriceCash && (
                            <span className="text-muted-foreground text-paragraph-xs">
                              {formatCLP(i.priceCash - i.cheapestPriceCash)} más que en {i.cheapestStore.name}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 text-paragraph-sm tabular-nums">{formatCLP(i.priceCash)}</span>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          {ok && (
            <Button size="sm" onClick={() => setOpen(false)}>
              Aplicar: {plan.storesAfter} tiendas
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
