import { IconAlertTriangle, IconBuildingStore, IconExternalLink, IconPlus, IconTrash } from "@tabler/icons-react";
import { domAnimation, LazyMotion, m } from "motion/react";
import { useNavigate } from "react-router";
import { getCategoryConfig } from "~/features/category/utils/categories";
import { ProductSpecs } from "~/features/quote/components/product-specs";
import { StoreSelector } from "~/features/quote/components/store-selector";
import type { VirtualQuoteItem } from "~/features/quote/services/quotes";
import { OutboundLink } from "~/shared/components/outbound-link";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { Button } from "~/shared/components/primitives/button";
import { StoreLogo } from "~/shared/components/store-logo";
import { formatCLP } from "~/shared/utils/format";
import { getImageUrl } from "~/shared/utils/images";

interface QuoteItemProps {
  item: VirtualQuoteItem;
  onRemove: (item: VirtualQuoteItem) => void;
  onChangeStore: (item: VirtualQuoteItem, listingId: string | null) => void;
  isOwner: boolean;
}

export function QuoteItem({ item, onRemove, onChangeStore, isOwner }: QuoteItemProps) {
  const product = item.product;
  const navigate = useNavigate();

  // Placeholder State
  if (!product) {
    return (
      <LazyMotion features={domAnimation}>
        <m.div
          layout
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
          key={item.virtualId}
          className="group relative"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 hover:bg-secondary/30 transition-colors duration-200 items-center border-l-4 border-transparent hover:border-primary/50">
            <div className="col-span-1 md:col-span-5 flex items-center gap-4">
              <div className="size-14 shrink-0 rounded-lg bg-secondary/20 border border-dashed border-border flex items-center justify-center">
                <IconPlus className="text-muted-foreground" />
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {item.product?.category?.name || "Componente"}
                </span>
                <p className="text-sm text-muted-foreground">Falta seleccionar producto</p>
              </div>
            </div>

            <div className="col-span-1 md:col-span-7 flex justify-end items-center gap-4">
              {isOwner && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      if (item.product?.category?.slug) {
                        navigate(`/categoria/${item.product.category.slug}`);
                      }
                    }}
                  >
                    <IconPlus size={16} /> Agregar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onRemove(item)}
                  >
                    <IconTrash size={16} />
                  </Button>
                </>
              )}
            </div>
          </div>
        </m.div>
      </LazyMotion>
    );
  }

  const selectedListing = item.selected_listing;
  const priceNormal = selectedListing ? selectedListing.price_normal : product.prices?.normal || 0;
  const priceCash = selectedListing ? selectedListing.price_cash : product.prices?.cash || 0;

  // Availability Logic
  const isOutOfStock = selectedListing && selectedListing.stock_quantity === 0;
  const isUnavailable = !selectedListing;

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        layout
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
        key={item.virtualId}
        className="group relative"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 hover:bg-secondary/30 transition-colors duration-200 items-center">
          <div className="col-span-1 md:col-span-5 flex items-center gap-4">
            <div className="size-14 shrink-0 rounded-lg bg-card p-1 border border-border/40 overflow-hidden flex items-center justify-center relative">
              {product.image_url ? (
                <AsyncImage
                  src={getImageUrl(product.image_url)}
                  alt={product.name || "Product Image"}
                  className={`size-full object-contain ${isOutOfStock || isUnavailable ? "opacity-50 grayscale" : ""}`}
                />
              ) : (
                <div className="size-full bg-secondary/50" />
              )}
              {(isOutOfStock || isUnavailable) && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
                  <IconAlertTriangle size={20} className="text-warn" />
                </div>
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  {getCategoryConfig(product.category?.slug || "")?.label || "Componente"}
                </span>
                {product.brand?.name && <span className="text-xs text-muted-foreground">{product.brand.name}</span>}
              </div>
              <h3 className="font-medium text-foreground truncate pr-4 text-sm md:text-base">{product.name}</h3>
              <ProductSpecs product={product} />
              {(isOutOfStock || isUnavailable) && (
                <p className="text-xs font-medium text-wa dark:text-warn flex items-center gap-1">
                  <IconAlertTriangle size={12} />
                  {isUnavailable ? "No disponible en tiendas" : "Sin stock"}
                </p>
              )}
            </div>
          </div>

          {isOutOfStock || isUnavailable ? (
            <span className="col-span-1 md:col-span-2 text-sm text-muted-foreground flex items-center gap-1">
              <IconAlertTriangle size={14} />
              {isOutOfStock ? "Sin stock" : "No disponible"}
            </span>
          ) : (
            <div className="col-span-1 md:col-span-2 flex items-center gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {selectedListing?.store ? (
                  selectedListing.url ? (
                    <OutboundLink
                      href={selectedListing.url}
                      source="quote_item"
                      listingId={selectedListing.id}
                      productId={product.id}
                      className="hover:opacity-80 transition-opacity"
                    >
                      <StoreLogo
                        store={selectedListing.store}
                        className={`size-5 rounded-sm ${isOutOfStock ? "opacity-50 grayscale" : ""}`}
                      />
                    </OutboundLink>
                  ) : (
                    <StoreLogo
                      store={selectedListing.store}
                      className={`size-5 rounded-sm ${isOutOfStock ? "opacity-50 grayscale" : ""}`}
                    />
                  )
                ) : (
                  <div className="size-5 rounded-sm bg-secondary flex items-center justify-center">
                    <IconBuildingStore size={12} className="text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    {selectedListing?.url ? (
                      <OutboundLink
                        href={selectedListing.url}
                        source="quote_item"
                        listingId={selectedListing.id}
                        productId={product.id}
                        className={`text-sm font-medium truncate hover:text-primary flex items-center gap-1 ${
                          isOutOfStock ? "text-muted-foreground line-through decoration-muted-foreground" : ""
                        }`}
                      >
                        {selectedListing.store.name}
                        <IconExternalLink size={12} className="text-muted-foreground" />
                      </OutboundLink>
                    ) : (
                      <span
                        className={`text-sm font-medium truncate ${isOutOfStock ? "text-muted-foreground line-through decoration-muted-foreground" : ""}`}
                      >
                        {selectedListing?.store?.name || "Mejor precio"}
                      </span>
                    )}
                  </div>
                  <StoreSelector
                    product={product}
                    currentListingId={item.listing_id}
                    onSelect={(id) => onChangeStore(item, id)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="col-span-1 md:col-span-2 flex md:flex-col justify-between md:justify-center md:items-end gap-1">
            <span className="md:hidden text-sm text-muted-foreground">Normal:</span>
            <span className="text-sm text-muted-foreground line-through decoration-muted-foreground">
              {formatCLP(priceNormal || 0)}
            </span>
          </div>

          <div className="col-span-1 md:col-span-2 flex md:flex-col justify-between md:justify-center md:items-end gap-1 relative">
            <span className="md:hidden text-sm font-medium">Efectivo:</span>
            <span className="font-mono text-lg font-medium text-foreground">{formatCLP(priceCash || 0)}</span>

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
                className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(item)}
                title="Eliminar producto"
              >
                <IconTrash size={16} />
              </Button>
            )}
          </div>
        </div>
      </m.div>
    </LazyMotion>
  );
}
