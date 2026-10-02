import type { Offer, QuoteItem } from "@framerate/contracts";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { productsService } from "~/features/product/services/products";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/shared/components/primitives/dialog";
import { StoreLogo } from "~/shared/components/store-logo";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";

interface StoreSelectorProps {
  item: QuoteItem;
  /** `null` = mejor precio disponible. */
  onChoose: (offer: Offer | null) => void;
}

/** Elegir con qué tienda cuenta un ítem: una de sus ofertas con stock, o siempre el mejor precio. */
export function StoreSelector({ item, onChoose }: StoreSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const offers = useQuery({
    queryKey: ["product-offers", item.product.slug],
    queryFn: async () => (await productsService.getBySlug(item.product.slug)).offers,
    enabled: open,
    staleTime: 60_000,
  });

  const choose = (offer: Offer | null) => {
    onChoose(offer);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex min-w-0 cursor-pointer items-center gap-1 text-sm font-medium hover:text-primary"
        >
          <span className="truncate">{item.offer?.store.name ?? t("quote_choose_store")}</span>
          <IconChevronDown size={14} className="shrink-0 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card">
        <DialogHeader>
          <DialogTitle>{t("quote_choose_store")}</DialogTitle>
          <DialogDescription className="truncate">{item.product.name}</DialogDescription>
        </DialogHeader>

        <ul className="grid gap-2">
          <Row selected={item.chosenListingId === null} onClick={() => choose(null)}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t("quote_best_price")}</p>
              <p className="text-xs text-muted-foreground">{t("quote_best_price_hint")}</p>
            </div>
          </Row>

          {offers.isLoading && <li className="px-3 py-2 text-sm text-muted-foreground">{t("quote_offers_loading")}</li>}
          {offers.isError && <li className="px-3 py-2 text-sm text-destructive">{t("quote_offers_error")}</li>}
          {offers.data?.map((offer) => (
            <Row
              key={offer.id}
              selected={item.chosenListingId === offer.id}
              disabled={!offer.inStock}
              onClick={() => choose(offer)}
            >
              <StoreLogo store={offer.store} className="size-6 rounded-md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{offer.store.name}</p>
                <p className="text-xs text-muted-foreground">
                  {offer.inStock
                    ? t("quote_offer_prices", { cash: formatCLP(offer.priceCash), card: formatCLP(offer.priceCard) })
                    : t("out_of_stock")}
                </p>
              </div>
            </Row>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={selected}
        onClick={onClick}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          selected ? "border-primary bg-primary/5" : "border-border/60 hover:bg-secondary/40",
        )}
      >
        {children}
        {selected && <IconCheck size={16} className="shrink-0 text-primary" />}
      </button>
    </li>
  );
}
