import { IconBuildingStore, IconChevronDown, IconRefresh, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "~/components/primitives/button";
import { cn } from "~/lib/utils";
import { productsService } from "~/services/products";
import type { Listing, Product } from "~/utils/db-types";
import { formatCLP } from "~/utils/format";

export function StoreSelector({
  product,
  currentListingId,
  onSelect,
}: {
  product: Product;
  currentListingId?: string | null;
  onSelect: (listingId: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleOpen = async () => {
    setIsOpen(true);
    setLoading(true);
    try {
      const data = await productsService.getBySlug(product.slug);
      if (data?.listings) {
        console.log("Loaded listings for", product.slug, data.listings);
        setListings(data.listings);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className={cn(
          "h-auto py-1 px-2 text-xs font-normal text-muted-foreground hover:text-foreground gap-1.5 border border-transparent hover:border-border/50 hover:bg-secondary/50",
        )}
      >
        {currentListingId ? (
          <span className="flex items-center gap-1.5">
            <IconBuildingStore size={12} />
            <span className="truncate max-w-20">Cambiar</span>
          </span>
        ) : (
          <>
            <IconBuildingStore size={12} />
            <span>Mejor precio</span>
          </>
        )}
        <IconChevronDown size={10} className="opacity-50" />
      </Button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-background/10 backdrop-blur-md"
                  onClick={() => setIsOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="relative w-full max-w-md rounded-2xl border border-border/50 bg-card/95 shadow-2xl overflow-hidden backdrop-blur-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-4 py-3">
                    <span className="text-sm font-medium text-foreground">Seleccionar tienda</span>
                    <button
                      type="button"
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors",
                        "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] cursor-pointer",
                      )}
                      onClick={() => setIsOpen(false)}
                    >
                      <IconX className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                    {loading ? (
                      <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                        <IconRefresh className="animate-spin opacity-50" size={20} />
                        <span>Cargando tiendas...</span>
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onSelect(null);
                            setIsOpen(false);
                          }}
                          className={cn(
                            "group flex items-center justify-between p-3 rounded-xl border transition-all text-left cursor-pointer",
                            !currentListingId
                              ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20 cursor-default"
                              : "border-border/40 bg-card hover:bg-secondary/40 hover:border-border/80",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                !currentListingId ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
                              )}
                            >
                              <IconBuildingStore size={20} />
                            </div>
                            <div>
                              <div
                                className={cn(
                                  "font-medium text-sm",
                                  !currentListingId ? "text-primary" : "text-foreground",
                                )}
                              >
                                Mejor precio automático
                              </div>
                              <div className="text-xs text-muted-foreground">Selecciona la mejor opción disponible</div>
                            </div>
                          </div>
                          {!currentListingId && <div className="h-2 w-2 rounded-full bg-primary mr-2" />}
                        </button>

                        {listings.map((listing) => (
                          <button
                            type="button"
                            key={listing.id}
                            onClick={() => {
                              if (listing.id) {
                                onSelect(listing.id);
                                setIsOpen(false);
                              } else {
                                console.error("Listing ID missing", listing);
                              }
                            }}
                            className={cn(
                              "group flex items-center justify-between p-3 rounded-xl border transition-all text-left cursor-pointer",
                              currentListingId === listing.id
                                ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20 cursor-default"
                                : "border-border/40 bg-card hover:bg-secondary/40 hover:border-border/80",
                            )}
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div
                                className={cn(
                                  "h-10 w-10 rounded-lg p-1.5 border border-border/30 flex items-center justify-center overflow-hidden shrink-0 ",
                                  listing.store?.appearance === "dark" ? "bg-white/10" : "bg-secondary/10",
                                )}
                              >
                                {listing.store?.logo_url ? (
                                  <img
                                    src={listing.store.logo_url}
                                    alt={listing.store.name}
                                    className="h-full w-full object-contain"
                                  />
                                ) : (
                                  <IconBuildingStore size={20} className="text-muted-foreground" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div
                                  className={cn(
                                    "font-medium text-sm truncate transition-colors",
                                    currentListingId === listing.id ? "text-primary" : "text-foreground",
                                  )}
                                >
                                  {listing.store?.name}
                                </div>
                                <div className="text-xs text-muted-foreground line-clamp-1 break-all opacity-70">
                                  {listing.url}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <div
                                className={cn(
                                  "font-mono font-medium text-sm",
                                  currentListingId === listing.id ? "text-primary" : "text-foreground",
                                )}
                              >
                                {formatCLP(listing.price_cash)}
                              </div>
                              <div className="text-xs text-muted-foreground line-through decoration-muted-foreground opacity-60">
                                {formatCLP(listing.price_normal)}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
