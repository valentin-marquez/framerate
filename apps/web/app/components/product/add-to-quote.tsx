import { IconCheck, IconLoader2, IconPlus, IconReceipt, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuoteAddItem, useQuotes } from "@/hooks/useQuotes";
import { cn } from "@/lib/utils";
import { useQuoteInteractionStore } from "@/store/quote-interaction";
import type { Product } from "@/utils/db-types";
import { Button } from "../primitives/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";
import { CreateQuoteDialog } from "../quotes/create-quote-dialog";

interface AddToQuoteProps {
  product: Product;
  className?: string;
}

export function AddToQuote({ product, className }: AddToQuoteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { lastSelectedQuoteId, setLastSelectedQuoteId } = useQuoteInteractionStore();
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>(lastSelectedQuoteId || "");

  // Fetch more quotes for the dropdown to ensure we see most of them
  const { data: quotes, isLoading: isLoadingQuotes } = useQuotes(1, 50);
  const addItem = useQuoteAddItem();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync local state with store when store changes (e.g. changed in another component)
  useEffect(() => {
    if (lastSelectedQuoteId) {
      setSelectedQuoteId(lastSelectedQuoteId);
    }
  }, [lastSelectedQuoteId]);

  // If we have quotes but no selection, and we have a lastSelectedQuoteId that is in the list, select it.
  useEffect(() => {
    if (quotes && quotes.data.length > 0 && !selectedQuoteId) {
      if (lastSelectedQuoteId && quotes.data.find((q) => q.id === lastSelectedQuoteId)) {
        setSelectedQuoteId(lastSelectedQuoteId);
      }
    }
  }, [quotes, lastSelectedQuoteId, selectedQuoteId]);

  const handleAdd = () => {
    if (!selectedQuoteId) return;

    setLastSelectedQuoteId(selectedQuoteId);

    addItem.mutate(
      {
        quoteId: selectedQuoteId,
        data: {
          product_id: product.id,
          quantity: 1,
        },
      },
      {
        onSuccess: () => {
          setIsOpen(false);
          // TODO: Show toast
        },
      },
    );
  };

  return (
    <>
      <div className={cn("relative", className)}>
        <Tooltip>
          <TooltipTrigger>
            <Button
              variant="secondary"
              size={className?.includes("w-full") ? "default" : "icon"}
              className={cn(className?.includes("w-full") ? "w-full gap-2" : "", "transition-all")}
              onClick={() => setIsOpen(true)}
              aria-label="Agregar a cotización"
              type="button"
            >
              <IconReceipt className="h-4 w-4" />
              {className?.includes("w-full") && <span className="text-xs font-medium">Agregar a cotización</span>}
            </Button>
          </TooltipTrigger>

          <TooltipContent side="top">Agregar a cotización</TooltipContent>
        </Tooltip>
      </div>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => setIsOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
                    <span className="text-sm font-medium text-foreground">Agregar a cotización</span>
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

                  <div className="p-4 space-y-4">
                    {isLoadingQuotes ? (
                      <div className="flex justify-center py-4">
                        <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : quotes && quotes.data.length > 0 ? (
                      <div className="space-y-2">
                        <label
                          htmlFor={`quote-select-${product.id}`}
                          className="text-sm font-medium text-muted-foreground"
                        >
                          Seleccionar cotización
                        </label>
                        <select
                          id={`quote-select-${product.id}`}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={selectedQuoteId}
                          onChange={(e) => {
                            setSelectedQuoteId(e.target.value);
                            setLastSelectedQuoteId(e.target.value);
                          }}
                        >
                          <option value="">Seleccionar...</option>
                          {quotes.data.map((quote) => (
                            <option key={quote.id} value={quote.id}>
                              {quote.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <p className="text-sm text-muted-foreground mb-3">No tienes cotizaciones creadas</p>
                        <CreateQuoteDialog
                          trigger={
                            <Button variant="outline" size="sm" className="w-full">
                              <IconPlus className="mr-2 h-4 w-4" /> Crear nueva
                            </Button>
                          }
                          onSuccess={(id) => {
                            setSelectedQuoteId(id);
                            setLastSelectedQuoteId(id);
                          }}
                        />
                      </div>
                    )}

                    {quotes && quotes.data.length > 0 && (
                      <Button className="w-full" onClick={handleAdd} disabled={!selectedQuoteId || addItem.isPending}>
                        {addItem.isPending ? (
                          <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <IconCheck className="mr-2 h-4 w-4" />
                        )}
                        Confirmar
                      </Button>
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
