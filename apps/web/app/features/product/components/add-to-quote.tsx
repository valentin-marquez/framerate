import type { ProductSummary } from "@framerate/contracts";
import { IconLoader2, IconLogin, IconPlus, IconReceipt, IconX } from "@tabler/icons-react";
import { type FormEvent, type SyntheticEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AuthProvidersList } from "~/features/auth/components/auth-providers-list";
import { useUser } from "~/features/auth/hooks/useAuth";
import { QUOTE_ROW_CLASS, QuoteRow } from "~/features/quote/components/quote-row";
import {
  useCreateQuote,
  useQuoteAddItem,
  useQuoteRemoveItem,
  useQuotes,
  useQuoteUpdateItem,
} from "~/features/quote/hooks/useQuotes";
import { useQuoteInteractionStore } from "~/features/quote/store/quote-interaction";
import { Button } from "~/shared/components/primitives/button";
import { Input } from "~/shared/components/primitives/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/components/primitives/tooltip";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";

type QuoteProduct = Pick<ProductSummary, "id" | "name">;

interface AddToQuoteProps {
  product: QuoteProduct;
  className?: string;
  /** Texto junto al ícono: "Agregar a cotización" (`long`) o "Cotizar" (`short`). Sin él, sólo ícono con tooltip. */
  label?: "long" | "short";
}

/** Agrega el producto a una cotización y avisa con deshacer; si viene de un slot, también ofrece volver a ella. */
function useAddToQuote(product: QuoteProduct) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addItem = useQuoteAddItem();
  const removeItem = useQuoteRemoveItem();
  const updateItem = useQuoteUpdateItem();
  const setLastSelectedQuoteId = useQuoteInteractionStore((s) => s.setLastSelectedQuoteId);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const add = (quote: { id: string; name: string }, onAdded?: () => void) => {
    setPendingId(quote.id);
    addItem.mutate(
      { quoteId: quote.id, data: { productId: product.id, quantity: 1 } },
      {
        onSuccess: (detail) => {
          // Si el producto ya estaba, agregar sólo sumó una unidad: deshacer resta esa unidad en vez de quitarlo.
          const item = detail.items.find((i) => i.product.id === product.id);
          setLastSelectedQuoteId(quote.id);
          onAdded?.();
          toast.success(t("product_added", { name: quote.name }), {
            action: {
              label: t("undo"),
              onClick: () => {
                if (!item) return;
                if (item.quantity > 1) {
                  updateItem.mutate({ quoteId: quote.id, itemId: item.id, data: { quantity: item.quantity - 1 } });
                } else {
                  removeItem.mutate({ quoteId: quote.id, itemId: item.id });
                }
              },
            },
            cancel: {
              label: t("back_to_quote"),
              onClick: () => navigate(`/cotizacion/${quote.id}`),
            },
          });
        },
        onError: () => toast.error(t("add_to_quote_error")),
        onSettled: () => setPendingId(null),
      },
    );
  };

  return { add, pendingId };
}

export function AddToQuote({ product, className, label }: AddToQuoteProps) {
  // "closing" mantiene el diálogo montado mientras anima la salida.
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const { t } = useTranslation();
  const originQuote = useQuoteInteractionStore((s) => s.originQuote);
  const { add } = useAddToQuote(product);

  return (
    <>
      <div className={cn("relative", className)}>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="secondary"
                // "long" acompaña al botón grande de la tienda en la ficha: misma altura y padding.
                size={label === "long" ? "lg" : label ? "sm" : "icon"}
                className={cn(
                  label ? "w-full gap-1.5 text-foreground" : "",
                  label === "short" && "px-3",
                  "transition-all",
                )}
                onClick={() => (originQuote ? add(originQuote) : setPhase("open"))}
                aria-label={t("add_to_quote")}
                type="button"
              />
            }
          >
            <IconReceipt className="size-4" />
            {label && (
              <span className="font-medium text-sm">{label === "short" ? t("quote_short") : t("add_to_quote")}</span>
            )}
          </TooltipTrigger>

          {!label && <TooltipContent side="top">{t("add_to_quote")}</TooltipContent>}
        </Tooltip>
      </div>

      {phase !== "closed" && (
        <AddToQuoteDialog
          product={product}
          closing={phase === "closing"}
          onClose={() => setPhase((p) => (p === "open" ? "closing" : p))}
          onClosed={() => setPhase("closed")}
        />
      )}
    </>
  );
}

interface AddToQuoteDialogProps {
  product: QuoteProduct;
  closing: boolean;
  onClose: () => void;
  onClosed: () => void;
}

// Aparte del botón para que Storybook lo muestre con datos de ejemplo.
export function AddToQuoteDialog({ product, closing, onClose, onClosed }: AddToQuoteDialogProps) {
  const { t } = useTranslation();
  const user = useUser();
  const { data: quotes, isLoading } = useQuotes(1, 50, { enabled: !!user });
  const lastSelectedQuoteId = useQuoteInteractionStore((s) => s.lastSelectedQuoteId);
  const createQuote = useCreateQuote();
  const { add: addToQuote, pendingId } = useAddToQuote(product);
  const [creating, setCreating] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const list = quotes?.items ?? [];
  const showForm = creating || (!!quotes && list.length === 0);
  const busy = pendingId !== null || createQuote.isPending;

  // showModal atrapa el foco, convierte Esc en el evento cancel y devuelve el foco al botón al cerrar. Como corre
  // después del autoFocus de React, si ya está el campo de nombre (sin cotizaciones) el foco se pasa a mano.
  useEffect(() => {
    dialogRef.current?.showModal();
    dialogRef.current?.querySelector("input")?.focus();
  }, []);

  const add = (quote: { id: string; name: string }) => addToQuote(quote, onClose);

  const create = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    if (!name) return;
    createQuote.mutate(
      { name, visibility: "private" },
      { onSuccess: add, onError: () => toast.error(t("add_to_quote_error")) },
    );
  };

  // Esc retrocede un nivel: primero cierra el campo de nombre, después el diálogo.
  const onCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    if (creating && list.length > 0) setCreating(false);
    else onClose();
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={onCancel}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none items-center justify-center border-0 bg-transparent p-4 backdrop:bg-transparent open:flex"
    >
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 bg-black/50 duration-200 fill-mode-forwards",
          closing ? "animate-out fade-out-0" : "animate-in fade-in-0",
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-2xl duration-200 ease-out fill-mode-forwards",
          closing
            ? "animate-out fade-out-0 zoom-out-95 slide-out-to-bottom-2"
            : "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2",
        )}
        onAnimationEnd={(e) => {
          if (e.target !== e.currentTarget || !closing) return;
          dialogRef.current?.close();
          onClosed();
        }}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-medium text-foreground">
              {t("add_to_quote")}
            </h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{product.name}</p>
          </div>
          <button
            type="button"
            aria-label={t("close")}
            onClick={onClose}
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
          >
            <IconX className="size-4" />
          </button>
        </header>

        <div className="p-2">
          {!user ? (
            <div className="space-y-3 p-2">
              <div className="flex flex-col items-center gap-2 py-2 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <IconLogin className="size-5" />
                </div>
                <p className="text-sm font-medium text-foreground">{t("login_to_save_quote_title")}</p>
                <p className="max-w-[260px] text-xs text-muted-foreground">{t("login_to_save_quote_desc")}</p>
              </div>
              <AuthProvidersList />
            </div>
          ) : isLoading ? (
            <div className="flex justify-center py-6">
              <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              <li>
                {showForm ? (
                  <form onSubmit={create} className="flex items-center gap-2 px-2 py-1.5">
                    <Input
                      name="name"
                      autoFocus
                      required
                      placeholder={t("quote_name_placeholder")}
                      aria-label={t("new_quote")}
                      disabled={createQuote.isPending}
                      className="h-9 flex-1"
                    />
                    <Button type="submit" size="sm" disabled={busy}>
                      {createQuote.isPending ? <IconLoader2 className="animate-spin" /> : t("create")}
                    </Button>
                  </form>
                ) : (
                  <button
                    type="button"
                    // biome-ignore lint/a11y/noAutofocus: al cerrar el campo con Esc el foco vuelve aquí en vez de perderse en el body
                    autoFocus
                    onClick={() => setCreating(true)}
                    disabled={busy}
                    className={QUOTE_ROW_CLASS}
                  >
                    <IconPlus className="mx-2.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{t("new_quote")}</span>
                  </button>
                )}
              </li>
              {list.map((quote) => (
                <li key={quote.id}>
                  <QuoteRow quote={quote} onClick={() => add(quote)} disabled={busy}>
                    {pendingId === quote.id ? (
                      <IconLoader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : quote.id === lastSelectedQuoteId ? (
                      <span className="shrink-0 text-xs text-muted-foreground">{t("last_used")}</span>
                    ) : null}
                  </QuoteRow>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
