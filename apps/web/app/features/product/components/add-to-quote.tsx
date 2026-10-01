import { IconLoader2, IconLogin, IconPlus, IconReceipt, IconX } from "@tabler/icons-react";
import { type FormEvent, type SyntheticEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AuthProvidersList } from "~/features/auth/components/auth-providers-list";
import { useUser } from "~/features/auth/hooks/useAuth";
import { useCreateQuote, useQuoteAddItem, useQuoteRemoveItem, useQuotes } from "~/features/quote/hooks/useQuotes";
import { QUOTES_API_ENABLED } from "~/features/quote/services/quotes";
import { useQuoteInteractionStore } from "~/features/quote/store/quote-interaction";
import { Button } from "~/shared/components/primitives/button";
import { Input } from "~/shared/components/primitives/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/components/primitives/tooltip";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";
import type { Product } from "~/shared/utils/db-types";
import { getGradient } from "~/shared/utils/gradients";

type QuoteProduct = Pick<Product, "id" | "name">;

interface AddToQuoteProps {
  product: QuoteProduct;
  className?: string;
  /** Texto junto al ícono: "Agregar a cotización" (`long`) o "Cotizar" (`short`). Sin él, sólo ícono con tooltip. */
  label?: "long" | "short";
}

export function AddToQuote({ product, className, label }: AddToQuoteProps) {
  // "closing" mantiene el diálogo montado mientras anima la salida.
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const { t } = useTranslation();

  if (!QUOTES_API_ENABLED) return null;

  return (
    <>
      <div className={cn("relative", className)}>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="secondary"
                size={label ? "sm" : "icon"}
                className={cn(label ? "w-full gap-1.5 px-3 text-foreground" : "", "transition-all")}
                onClick={() => setPhase("open")}
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

const ROW_CLASS =
  "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-60";

interface AddToQuoteDialogProps {
  product: QuoteProduct;
  closing: boolean;
  onClose: () => void;
  onClosed: () => void;
}

// Aparte del botón para que Storybook lo muestre con datos de ejemplo mientras no exista la API (#25).
export function AddToQuoteDialog({ product, closing, onClose, onClosed }: AddToQuoteDialogProps) {
  const { t } = useTranslation();
  const user = useUser();
  const { data: quotes, isLoading } = useQuotes(1, 50, { enabled: !!user });
  const { lastSelectedQuoteId, setLastSelectedQuoteId } = useQuoteInteractionStore();
  const createQuote = useCreateQuote();
  const addItem = useQuoteAddItem();
  const removeItem = useQuoteRemoveItem();
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const list = quotes?.data ?? [];
  const showForm = creating || (!!quotes && list.length === 0);
  const busy = pendingId !== null || createQuote.isPending;

  // showModal atrapa el foco, convierte Esc en el evento cancel y devuelve el foco al botón al cerrar. Como corre
  // después del autoFocus de React, si ya está el campo de nombre (sin cotizaciones) el foco se pasa a mano.
  useEffect(() => {
    dialogRef.current?.showModal();
    dialogRef.current?.querySelector("input")?.focus();
  }, []);

  const add = (quote: { id: string; name: string }) => {
    if (!product.id) return;
    setPendingId(quote.id);
    addItem.mutate(
      { quoteId: quote.id, data: { product_id: product.id, quantity: 1 } },
      {
        onSuccess: (item) => {
          setLastSelectedQuoteId(quote.id);
          onClose();
          toast.success(t("product_added", { name: quote.name }), {
            action: { label: t("undo"), onClick: () => removeItem.mutate({ quoteId: quote.id, itemId: item.id }) },
          });
        },
        onError: () => toast.error(t("add_to_quote_error")),
        onSettled: () => setPendingId(null),
      },
    );
  };

  const create = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    if (!name) return;
    createQuote.mutate({ name }, { onSuccess: add, onError: () => toast.error(t("add_to_quote_error")) });
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
            {product.name && <p className="mt-0.5 truncate text-xs text-muted-foreground">{product.name}</p>}
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
                    className={ROW_CLASS}
                  >
                    <IconPlus className="mx-2.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{t("new_quote")}</span>
                  </button>
                )}
              </li>
              {list.map((quote) => {
                const count = quote.quote_items?.[0]?.count ?? 0;
                return (
                  <li key={quote.id}>
                    <button type="button" onClick={() => add(quote)} disabled={busy} className={ROW_CLASS}>
                      <span className="size-9 shrink-0 rounded-md" style={{ background: getGradient(quote.id) }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{quote.name}</span>
                        <span className="flex gap-x-2 text-xs text-muted-foreground">
                          <span>{t(count === 1 ? "quote_components_one" : "profile_components_count", { count })}</span>
                          {!quote.is_public && <span>{t("quote_private")}</span>}
                        </span>
                      </span>
                      {pendingId === quote.id ? (
                        <IconLoader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                      ) : quote.id === lastSelectedQuoteId ? (
                        <span className="shrink-0 text-xs text-muted-foreground">{t("last_used")}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
