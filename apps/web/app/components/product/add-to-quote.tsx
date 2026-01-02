import { IconCheck, IconLoader2, IconPlus, IconReceipt, IconX } from "@tabler/icons-react";
import { AnimatePresence, MotionConfig, motion, type Transition } from "motion/react";
import { useEffect, useRef, useState } from "react";
import useClickOutside from "@/hooks/useClickOutside";
import { useQuoteAddItem, useQuotes } from "@/hooks/useQuotes";
import { cn } from "@/lib/utils";
import { useQuoteInteractionStore } from "@/store/quote-interaction";
import type { Product } from "@/utils/db-types";
import { Button, buttonVariants } from "../primitives/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";
import { CreateQuoteDialog } from "../quotes/create-quote-dialog";

interface AddToQuoteProps {
  product: Product;
  className?: string;
}

const transition: Transition = {
  type: "spring",
  bounce: 0.1,
  duration: 0.25,
};

export function AddToQuote({ product, className }: AddToQuoteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { lastSelectedQuoteId, setLastSelectedQuoteId } = useQuoteInteractionStore();
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>(lastSelectedQuoteId || "");
  const ref = useRef<HTMLDivElement>(null);

  // Fetch more quotes for the dropdown to ensure we see most of them
  const { data: quotes, isLoading: isLoadingQuotes } = useQuotes(1, 50);
  const addItem = useQuoteAddItem();

  useClickOutside(ref, () => setIsOpen(false));

  // Sync local state with store when store changes (e.g. changed in another component)
  useEffect(() => {
    if (lastSelectedQuoteId) {
      setSelectedQuoteId(lastSelectedQuoteId);
    }
  }, [lastSelectedQuoteId]);

  // If we have quotes but no selection, and we have a lastSelectedQuoteId that is in the list, select it.
  // Or if no lastSelectedQuoteId, maybe select the first one?
  useEffect(() => {
    if (quotes && quotes.data.length > 0 && !selectedQuoteId) {
      if (lastSelectedQuoteId && quotes.data.find((q) => q.id === lastSelectedQuoteId)) {
        setSelectedQuoteId(lastSelectedQuoteId);
      } else {
        // Optional: Default to the most recently updated quote (first in list usually)
        // setSelectedQuoteId(quotes.data[0].id);
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
    <MotionConfig transition={transition}>
      <div className={cn("relative", className)} ref={ref}>
        <AnimatePresence initial={false} mode="popLayout">
          {!isOpen ? (
            <Tooltip>
              <TooltipTrigger>
                <motion.button
                  layoutId={`add-to-quote-${product.id}`}
                  className={cn(
                    buttonVariants({
                      variant: "secondary",
                      size: className?.includes("w-full") ? "default" : "icon",
                    }),
                    className?.includes("w-full") ? "w-full gap-2" : "",
                    "transition-all",
                    "bg-secondary/20 text-secondary-foreground/65",
                  )}
                  onClick={() => setIsOpen(true)}
                  aria-label="Agregar a cotización"
                  type="button"
                >
                  <motion.span layoutId={`icon-${product.id}`} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
                    <IconReceipt className="h-4 w-4" />
                  </motion.span>
                  {className?.includes("w-full") && <span className="text-xs font-medium">Agregar a cotización</span>}
                </motion.button>
              </TooltipTrigger>

              <TooltipContent side="top">Agregar a cotización</TooltipContent>
            </Tooltip>
          ) : (
            <motion.div
              layoutId={`add-to-quote-${product.id}`}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, delay: 0.1 }}
                className="relative w-full max-w-md rounded-lg border border-border bg-card shadow-md"
              >
                <div className="flex items-center justify-between border-b border-border bg-muted/30 p-2">
                  <span className="text-xs font-medium text-foreground px-1">Agregar a cotización</span>
                  <button
                    type="button"
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors",
                      "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] cursor-pointer",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                    }}
                  >
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="p-3 space-y-3">
                  {isLoadingQuotes ? (
                    <div className="flex justify-center py-4">
                      <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : quotes && quotes.data.length > 0 ? (
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`quote-select-${product.id}`}
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Seleccionar cotización
                      </label>
                      <select
                        id={`quote-select-${product.id}`}
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                      <p className="text-xs text-muted-foreground mb-2">No tienes cotizaciones creadas</p>
                      <CreateQuoteDialog
                        trigger={
                          <Button variant="outline" size="sm" className="w-full h-8 text-xs">
                            <IconPlus className="mr-1 h-3 w-3" /> Crear nueva
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
                    <Button
                      className="w-full h-8 text-xs font-medium"
                      onClick={handleAdd}
                      disabled={!selectedQuoteId || addItem.isPending}
                    >
                      {addItem.isPending ? (
                        <IconLoader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <IconCheck className="mr-2 h-3.5 w-3.5" />
                      )}
                      Confirmar
                    </Button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
