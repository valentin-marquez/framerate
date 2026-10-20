import { CONDENSE_STORE_VALUE, type QuoteDetail } from "@framerate/contracts";
import { imageVariant } from "@framerate/kit";
import { IconBuildingStore, IconChevronDown } from "@tabler/icons-react";
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
import { Input } from "~/shared/components/primitives/input";
import { StoreLogo } from "~/shared/components/store-logo";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import type { QuoteCondensePlan } from "../fixtures";

type PlanItem = QuoteCondensePlan["items"][number];
interface Option {
  stores: number;
  extra: number;
  items: PlanItem[];
}

const toOption = (items: PlanItem[]): Option => ({
  stores: new Set(items.map((i) => i.store.slug)).size,
  extra: items.reduce((sum, i) => sum + i.priceCash - i.cheapestPriceCash, 0),
  items,
});

/**
 * Opciones de menos a más tiendas. La API da un solo plan: la de 3 tiendas se inventa devolviendo a su tienda más
 * barata el primer componente que el plan encarece, y la última es comprar cada uno donde está más barato.
 */
function optionsFrom(plan: QuoteCondensePlan): Option[] {
  const moved = plan.items.findIndex((i) => i.priceCash > i.cheapestPriceCash);
  const middle = plan.items.map((i, n) =>
    n === moved ? { ...i, store: i.cheapestStore, priceCash: i.cheapestPriceCash } : i,
  );
  const cheapest = plan.items.map((i) => ({ ...i, store: i.cheapestStore, priceCash: i.cheapestPriceCash }));
  const all = [plan.items, middle, cheapest].map(toOption);
  return all.filter((o, n) => all.findIndex((p) => p.stores === o.stores) === n).sort((a, b) => a.stores - b.stores);
}

/** La de menos tiendas cuyo sobreprecio, repartido por cada tienda que se evita, no pasa del valor escrito. */
function bestOption(options: Option[], storeValue: number) {
  const base = options[options.length - 1] as Option;
  return (options.find((o) => o.stores === base.stores || o.extra / (base.stores - o.stores) <= storeValue) ?? base)
    .stores;
}

interface CondenseAProps {
  quote: Pick<QuoteDetail, "items" | "totals">;
  plan: QuoteCondensePlan;
  defaultOpen?: boolean;
}

export function CondenseA({ quote, plan, defaultOpen }: CondenseAProps) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [typed, setTyped] = useState(String(CONDENSE_STORE_VALUE));
  const [expanded, setExpanded] = useState<number | null>(null);
  const options = optionsFrom(plan);
  const parsed = Number.parseInt(typed, 10);
  const best = bestOption(options, Number.isFinite(parsed) && parsed >= 0 ? parsed : CONDENSE_STORE_VALUE);
  const shown = expanded ?? best;
  const inputId = useId();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconBuildingStore className="size-4" />
          Condensar tiendas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto bg-card p-4 max-sm:top-auto max-sm:bottom-0 max-sm:w-full max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-t-3xl max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-8 max-sm:zoom-in-100 max-sm:zoom-out-100 max-sm:slide-in-from-bottom-24 max-sm:slide-out-to-bottom-24 sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:rounded-3xl sm:p-6">
        <DialogHeader>
          <DialogTitle>Condensar tiendas</DialogTitle>
          <DialogDescription>
            Compra en menos tiendas pagando un poco más. Los precios no incluyen envío.
          </DialogDescription>
        </DialogHeader>

        <label
          htmlFor={inputId}
          className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-secondary/60 p-3 text-paragraph-sm"
        >
          Junta tiendas si la diferencia es menor a
          <span className="inline-flex items-center gap-1">
            $
            <Input
              id={inputId}
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setExpanded(null);
              }}
              className="h-8 w-24 text-right tabular-nums"
            />
          </span>
          por tienda
        </label>

        <ul className="mt-4 space-y-2">
          {options.map((option) => (
            <OptionRow
              key={option.stores}
              option={option}
              total={quote.totals.cash + option.extra}
              isBest={option.stores === best}
              open={option.stores === shown}
              onToggle={() => setExpanded(option.stores === shown ? -1 : option.stores)}
              quote={quote}
            />
          ))}
        </ul>

        <DialogFooter className="mt-4">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OptionRow({
  option,
  total,
  isBest,
  open,
  onToggle,
  quote,
}: {
  option: Option;
  total: number;
  isBest: boolean;
  open: boolean;
  onToggle: () => void;
  quote: CondenseAProps["quote"];
}) {
  const panelId = useId();
  const subtotals = [...new Set(option.items.map((i) => i.store.slug))].map((slug) => {
    const own = option.items.filter((i) => i.store.slug === slug);
    return { slug, name: own[0]?.store.name ?? slug, sum: own.reduce((s, i) => s + i.priceCash, 0) };
  });

  return (
    <li className="overflow-hidden rounded-2xl border border-border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40",
          open && "bg-secondary/40",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="text-label-sm">
            En {option.stores} tiendas: <span className="tabular-nums">{formatCLP(total)}</span>
          </span>
          <span className="block text-muted-foreground text-paragraph-xs">
            {option.extra === 0 ? "Lo más barato" : `${formatCLP(option.extra)} más que lo más barato`}
          </span>
        </span>
        {isBest && <span className="shrink-0 text-label-xs text-success">Recomendada</span>}
        <IconChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div id={panelId} className="border-border border-t">
          <p className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 text-muted-foreground text-paragraph-xs">
            {subtotals.map((s) => (
              <span key={s.slug}>
                {s.name} <span className="text-foreground tabular-nums">{formatCLP(s.sum)}</span>
              </span>
            ))}
          </p>
          <ul className="divide-y divide-border/60">
            {option.items.map((planItem) => {
              const item = quote.items.find((i) => i.id === planItem.itemId);
              const extra = planItem.priceCash - planItem.cheapestPriceCash;
              return (
                <li
                  key={planItem.itemId}
                  className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:grid-cols-[2.5rem_minmax(0,1fr)_9rem_7rem]"
                >
                  <span className="row-span-2 grid size-10 place-items-center rounded-lg bg-[var(--product-stage)] p-1 sm:row-span-1">
                    {item?.product.imageUrl && (
                      <img
                        src={imageVariant(item.product.imageUrl, 400)}
                        alt=""
                        className="size-full object-contain mix-blend-multiply"
                      />
                    )}
                  </span>
                  <span className="truncate text-paragraph-sm">{item?.product.name}</span>
                  <span className="flex min-w-0 items-center gap-2 text-paragraph-xs sm:text-paragraph-sm">
                    <StoreLogo store={planItem.store} className="size-5 rounded-md text-[9px]" />
                    <span className="truncate">{planItem.store.name}</span>
                    <span className="ml-auto tabular-nums sm:hidden">{formatCLP(planItem.priceCash)}</span>
                  </span>
                  <span className="hidden text-right sm:block">
                    <span className="block text-label-sm tabular-nums">{formatCLP(planItem.priceCash)}</span>
                    {extra > 0 && (
                      <span className="block text-muted-foreground text-paragraph-xs tabular-nums">
                        +{formatCLP(extra)}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end px-4 py-3">
            <Button size="sm" onClick={() => console.log("aplicar", option.stores)}>
              Comprar en {option.stores} tiendas
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
