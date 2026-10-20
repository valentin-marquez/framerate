import { type CompatCheck, type Offer, QUOTE_SLOT_LABELS, type QuoteItem as QuoteItemData } from "@framerate/contracts";
import { imageVariant } from "@framerate/kit";
import { IconAlertTriangle, IconCheck, IconExternalLink, IconMinus, IconPlus, IconTrash } from "@tabler/icons-react";
import { Link } from "react-router";
import { OutboundLink } from "~/shared/components/outbound-link";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { Badge } from "~/shared/components/primitives/badge";
import { Button } from "~/shared/components/primitives/button";
import { StoreLogo } from "~/shared/components/store-logo";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { CompatibilityIssue, STATUS_DOT } from "./quote-compatibility";
import { StoreSelector } from "./store-selector";

interface QuoteItemProps {
  item: QuoteItemData;
  isOwner: boolean;
  /** Peor resultado de los chequeos que lo involucran; sin chequeos no lleva punto. */
  status?: CompatCheck["result"];
  /** Incompatibilidades y advertencias que involucran a este ítem. */
  issues?: CompatCheck[];
  onChangeQuantity: (item: QuoteItemData, quantity: number) => void;
  onRemove: (item: QuoteItemData) => void;
  onChooseOffer: (item: QuoteItemData, offer: Offer | null) => void;
}

/** Una fila del armado: foto, slot, nombre, specs clave y avisos a la izquierda; dónde comprar a la derecha. */
export function QuoteItem({
  item,
  isOwner,
  status,
  issues = [],
  onChangeQuantity,
  onRemove,
  onChooseOffer,
}: QuoteItemProps) {
  const { t } = useTranslation();
  const { product, offer, quantity } = item;

  // Columna propia entre el nombre y el precio, centrada en la fila: ahí sobraba espacio y el pie del precio quedaba cargado.
  const quantityControl = isOwner ? (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
        onClick={() => onRemove(item)}
        aria-label="Eliminar producto"
      >
        <IconTrash size={14} />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="size-7"
        aria-label="Menos unidades"
        disabled={quantity <= 1}
        onClick={() => onChangeQuantity(item, quantity - 1)}
      >
        <IconMinus size={14} />
      </Button>
      <span className="w-8 text-center text-sm tabular-nums">{quantity}</span>
      <Button
        variant="outline"
        size="icon"
        className="size-7"
        aria-label="Más unidades"
        disabled={quantity >= 99}
        onClick={() => onChangeQuantity(item, quantity + 1)}
      >
        <IconPlus size={14} />
      </Button>
    </div>
  ) : quantity > 1 ? (
    <span className="shrink-0 text-sm font-medium text-muted-foreground tabular-nums">X{quantity}</span>
  ) : null;

  return (
    <div className="group flex flex-col gap-4 p-4 hover:bg-secondary/30 transition-colors sm:flex-row">
      <div className="flex min-w-0 flex-1 gap-4">
        <div className="size-14 shrink-0 rounded-lg bg-card p-1 border border-border/40 overflow-hidden flex items-center justify-center">
          {product.imageUrl ? (
            <AsyncImage
              src={imageVariant(product.imageUrl, 400)}
              alt={product.name}
              className={cn("size-full object-contain", !offer && "opacity-50 grayscale")}
            />
          ) : (
            <div className="size-full bg-secondary/50" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            {status && <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status])} />}
            <span className="font-medium uppercase tracking-wider text-muted-foreground">
              {QUOTE_SLOT_LABELS[item.slot]}
            </span>
            {product.brand && <span className="text-muted-foreground">{product.brand}</span>}
          </div>
          <Link
            to={`/producto/${product.slug}`}
            className="block font-medium leading-snug text-foreground hover:text-primary"
          >
            {product.name}
          </Link>
          {item.specs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.specs.map((spec) => (
                <span
                  key={spec}
                  className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground tabular-nums"
                >
                  {spec}
                </span>
              ))}
            </div>
          )}
          {!offer && (
            <p className="text-xs font-medium text-warn flex items-center gap-1">
              <IconAlertTriangle size={12} />
              No disponible en tiendas
            </p>
          )}
          {issues.map((check) => (
            <CompatibilityIssue key={check.rule} check={check} />
          ))}
        </div>
      </div>

      {quantityControl && <div className="shrink-0 pl-18 sm:self-center sm:pl-0">{quantityControl}</div>}

      <div className="flex shrink-0 items-end justify-between gap-1 pl-18 sm:flex-col sm:items-end sm:pl-0 sm:text-right">
        <div className="flex flex-col gap-1 sm:items-end">
          <div className="flex min-w-0 items-center gap-2">
            {offer && <StoreLogo store={offer.store} className="size-5 rounded-sm" />}
            {isOwner ? (
              <StoreSelector item={item} onChoose={(chosen) => onChooseOffer(item, chosen)} />
            ) : offer ? (
              <OutboundLink
                href={offer.url}
                source="quote_item"
                listingId={String(offer.id)}
                productId={String(product.id)}
                className="text-sm font-medium truncate hover:text-primary flex items-center gap-1"
              >
                {offer.store.name}
                <IconExternalLink size={12} className="text-muted-foreground" />
              </OutboundLink>
            ) : null}
          </div>
          {offer && (
            <>
              <span className="font-mono text-lg font-medium">{formatCLP(offer.priceCash * quantity)}</span>
              <span className="text-xs text-muted-foreground">
                con tarjeta <span className="tabular-nums">{formatCLP(offer.priceCard * quantity)}</span>
              </span>
              {isOwner && item.isSelected && item.chosenListingId === null && (
                <Badge variant="secondary" className="gap-1">
                  <IconCheck className="size-3" />
                  {t("quote_cheapest_badge")}
                </Badge>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
