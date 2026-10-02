import { CATEGORY_LABELS, type Offer, type QuoteItem as QuoteItemData } from "@framerate/contracts";
import { IconAlertTriangle, IconExternalLink, IconMinus, IconPlus, IconTrash } from "@tabler/icons-react";
import { Link } from "react-router";
import { OutboundLink } from "~/shared/components/outbound-link";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { Button } from "~/shared/components/primitives/button";
import { StoreLogo } from "~/shared/components/store-logo";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { StoreSelector } from "./store-selector";

interface QuoteItemProps {
  item: QuoteItemData;
  isOwner: boolean;
  onChangeQuantity: (item: QuoteItemData, quantity: number) => void;
  onRemove: (item: QuoteItemData) => void;
  onChooseOffer: (item: QuoteItemData, offer: Offer | null) => void;
}

export function QuoteItem({ item, isOwner, onChangeQuantity, onRemove, onChooseOffer }: QuoteItemProps) {
  const { product, offer, quantity } = item;

  return (
    <div className="group relative">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 hover:bg-secondary/30 transition-colors items-center">
        <div className="col-span-1 md:col-span-5 flex items-center gap-4">
          <div className="size-14 shrink-0 rounded-lg bg-card p-1 border border-border/40 overflow-hidden flex items-center justify-center">
            {product.imageUrl ? (
              <AsyncImage
                src={product.imageUrl}
                alt={product.name}
                className={cn("size-full object-contain", !offer && "opacity-50 grayscale")}
              />
            ) : (
              <div className="size-full bg-secondary/50" />
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                {CATEGORY_LABELS[product.category]}
              </span>
              {product.brand && <span className="text-xs text-muted-foreground">{product.brand}</span>}
            </div>
            <Link
              to={`/producto/${product.slug}`}
              className="block font-medium text-foreground truncate pr-4 text-sm md:text-base hover:text-primary"
            >
              {product.name}
            </Link>
            {!offer && (
              <p className="text-xs font-medium text-warn flex items-center gap-1">
                <IconAlertTriangle size={12} />
                No disponible en tiendas
              </p>
            )}
            {isOwner ? (
              <div className="flex items-center gap-1">
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
            ) : (
              quantity > 1 && <span className="text-xs text-muted-foreground tabular-nums">x{quantity}</span>
            )}
          </div>
        </div>

        <div className="col-span-1 md:col-span-2 flex items-center gap-2 min-w-0">
          {isOwner ? (
            <>
              {offer && <StoreLogo store={offer.store} className="size-5 rounded-sm" />}
              <StoreSelector item={item} onChoose={(chosen) => onChooseOffer(item, chosen)} />
            </>
          ) : offer ? (
            <>
              <StoreLogo store={offer.store} className="size-5 rounded-sm" />
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
            </>
          ) : (
            <span className="text-sm text-muted-foreground">No disponible</span>
          )}
        </div>

        <div className="col-span-1 md:col-span-2 flex md:flex-col justify-between md:justify-center md:items-end gap-1">
          <span className="md:hidden text-sm text-muted-foreground">Tarjeta:</span>
          <span className="text-sm text-muted-foreground line-through decoration-muted-foreground">
            {offer ? formatCLP(offer.priceCard * quantity) : "—"}
          </span>
        </div>

        <div className="col-span-1 md:col-span-2 flex md:flex-col justify-between md:justify-center md:items-end gap-1">
          <span className="md:hidden text-sm font-medium">Efectivo:</span>
          <span className="font-mono text-lg font-medium text-foreground">
            {offer ? formatCLP(offer.priceCash * quantity) : "—"}
          </span>
          {isOwner && (
            <div className="md:hidden mt-2 flex justify-end w-full">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => onRemove(item)}
              >
                <IconTrash size={16} className="mr-2" /> Eliminar
              </Button>
            </div>
          )}
        </div>

        <div className="hidden md:flex col-span-1 justify-end items-center">
          {isOwner && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
              onClick={() => onRemove(item)}
              aria-label="Eliminar producto"
            >
              <IconTrash size={16} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
