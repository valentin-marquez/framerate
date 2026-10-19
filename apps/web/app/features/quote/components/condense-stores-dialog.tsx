import { CONDENSE_MAX_EXTRA, type QuoteCondensePlan, type QuoteDetail } from "@framerate/contracts";
import { IconBuildingStore, IconInfoCircle, IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
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
import { useTranslation } from "~/shared/hooks/use-translation";
import { formatCLP } from "~/shared/utils/format";

interface CondenseStoresDialogProps {
  quote: Pick<QuoteDetail, "id" | "items">;
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

function CondensePanel({
  quote,
  onApply,
  onClose,
}: Pick<CondenseStoresDialogProps, "quote" | "onApply"> & { onClose: () => void }) {
  const { t } = useTranslation();
  const { data: plan, isLoading, isError } = useCondensePlan(quote.id);
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

  const names = new Map(quote.items.map((item) => [item.id, item.product.name]));
  const kept = plan?.items.filter((i) => i.keptByLimit).map((i) => names.get(i.itemId) ?? "") ?? [];

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("quote_condense_title")}</DialogTitle>
        <DialogDescription>
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

      {plan?.improves && kept.length > 0 && (
        <p className="flex items-start gap-2 text-muted-foreground text-xs">
          <IconInfoCircle className="mt-0.5 size-3.5 shrink-0" />
          {t("quote_condense_kept", { names: kept.join(", "), limit: formatCLP(CONDENSE_MAX_EXTRA) })}
        </p>
      )}

      <DialogFooter>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t("cancel")}
        </Button>
        {plan?.improves && (
          <Button size="sm" disabled={applying} onClick={() => apply(plan)}>
            {applying && <IconLoader2 className="size-4 animate-spin" />}
            {t("quote_condense_apply", { count: plan.storesAfter })}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
