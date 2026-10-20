import { CONDENSE_STORE_VALUE, type QuoteCondensePlan, type QuoteDetail } from "@framerate/contracts";
import { IconBuildingStore, IconLoader2 } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useCondensePlan } from "~/features/quote/hooks/useQuotes";
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
import { Label } from "~/shared/components/primitives/label";
import { useTranslation } from "~/shared/hooks/use-translation";
import { formatCLP } from "~/shared/utils/format";

interface CondenseStoresDialogProps {
  quote: Pick<QuoteDetail, "id">;
  /** Fija la tienda de cada ítem del plan y deja la cotización al día. */
  onApply: (plan: QuoteCondensePlan) => Promise<void>;
  defaultOpen?: boolean;
}

/** Propone comprar en menos tiendas (sin envíos) y muestra cuánto más cuesta; se aplica sólo al confirmar. */
export function CondenseStoresDialog({ quote, onApply, defaultOpen }: CondenseStoresDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconBuildingStore className="size-4" />
          {t("quote_condense_button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card">
        {/* El contenido se monta al abrir y se desmonta al cerrar: el plan se pide con los precios de ese momento. */}
        <CondensePanel quote={quote} onApply={onApply} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** El número que se escribe se aplica cuando se deja de teclear: cada cambio es una consulta al servidor. */
function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function CondensePanel({
  quote,
  onApply,
  onClose,
}: Pick<CondenseStoresDialogProps, "quote" | "onApply"> & { onClose: () => void }) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState(String(CONDENSE_STORE_VALUE));
  // Un campo vacío o inválido no consulta: se queda el último valor bueno.
  const parsed = Number.parseInt(typed, 10);
  const storeValue = useDebounced(Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, 1_000_000) : null, 400);
  const [lastValue, setLastValue] = useState(CONDENSE_STORE_VALUE);
  useEffect(() => {
    if (storeValue !== null) setLastValue(storeValue);
  }, [storeValue]);
  const { data: plan, isLoading, isError, isPlaceholderData } = useCondensePlan(quote.id, lastValue);
  const [applying, setApplying] = useState(false);

  const apply = async (chosen: QuoteCondensePlan) => {
    setApplying(true);
    try {
      await onApply(chosen);
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("quote_condense_title")}</DialogTitle>
        <DialogDescription className="text-foreground">
          {isLoading
            ? t("quote_condense_loading")
            : isError || !plan
              ? t("quote_condense_error")
              : plan.improves
                ? t("quote_condense_summary", {
                    before: plan.storesBefore,
                    after: plan.storesAfter,
                    extra: formatCLP(plan.extraCash),
                  })
                : t("quote_condense_none")}
        </DialogDescription>
      </DialogHeader>

      {isLoading && <IconLoader2 className="mx-auto size-5 animate-spin text-muted-foreground" />}

      {plan?.improves && (
        <ul className="divide-y divide-border/40 rounded-2xl border border-border/40">
          {plan.stores.map((store) => (
            <li key={store.slug} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-secondary text-[10px]">
                {store.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{store.name}</span>
              <span className="text-muted-foreground">
                {store.itemIds.length === 1
                  ? t("quote_condense_one")
                  : t("quote_condense_many", { count: store.itemIds.length })}
              </span>
              <span className="font-mono tabular-nums">{formatCLP(store.subtotalCash)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-1.5 rounded-2xl bg-secondary/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="condense-store-value" className="text-sm">
            {t("quote_condense_value_label")}
          </Label>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-sm">$</span>
            <Input
              id="condense-store-value"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-28 text-right tabular-nums text-foreground"
            />
          </div>
        </div>
        <p className="text-muted-foreground text-xs">{t("quote_condense_value_hint")}</p>
      </div>

      <DialogFooter>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t("cancel")}
        </Button>
        {plan?.improves && (
          <Button size="sm" disabled={applying || isPlaceholderData} onClick={() => apply(plan)}>
            {(applying || isPlaceholderData) && <IconLoader2 className="size-4 animate-spin" />}
            {t(plan.storesAfter === 1 ? "quote_condense_apply_one" : "quote_condense_apply", {
              count: plan.storesAfter,
            })}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
