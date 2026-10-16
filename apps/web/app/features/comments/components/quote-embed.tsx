import { QUOTE_SLOT_LABELS } from "@framerate/contracts";
import { imageVariant } from "@framerate/kit";
import { IconArrowUpRight, IconLayoutList, IconX } from "@tabler/icons-react";
import { AnimatePresence, domMax, LazyMotion, m, usePresence } from "motion/react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { useQuote } from "~/features/quote/hooks/useQuotes";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { Badge } from "~/shared/components/primitives/badge";
import { DURATION, EASE_IN_OUT, EASE_OUT } from "~/shared/lib/motion";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { getGradient } from "~/shared/utils/gradients";

interface QuoteEmbedProps {
  quoteId: string;
  href: string;
}

/**
 * Inline pill rendered in place of a /cotizacion/:id URL inside a comment body.
 *
 * Clicking the badge opens a quick-view dialog that morphs out of the pill
 * (shared `layoutId`) — gives a fast preview without leaving the page. The
 * dialog also exposes a link to the full cotización detail page.
 *
 * If the quote is inaccessible (private/404), we fall back to a plain link.
 */
export function QuoteEmbed({ quoteId, href }: QuoteEmbedProps) {
  const { data: quote, isLoading, isError } = useQuote(quoteId);
  const [open, setOpen] = useState(false);
  const layoutId = useId();

  // ESC closes the quick view; prevent body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (isLoading) {
    return (
      <Badge variant="outline" className="align-baseline gap-1.5 animate-pulse">
        <IconLayoutList className="text-muted-foreground" />
        <span className="text-muted-foreground">Cargando cotización…</span>
      </Badge>
    );
  }

  if (isError || !quote) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline-offset-4 hover:underline break-all"
      >
        {href}
      </a>
    );
  }

  const itemCount = quote.itemCount;

  return (
    <LazyMotion features={domMax}>
      <m.button
        type="button"
        layoutId={layoutId}
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex align-baseline items-center gap-1.5 max-w-full",
          "h-5 rounded-4xl border border-transparent bg-secondary text-secondary-foreground",
          "px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0",
          "hover:bg-secondary/80 transition-colors cursor-pointer",
          "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        )}
        // Hide the source element so motion can interpolate cleanly into the
        // dialog; we keep the layout space reserved so surrounding text doesn't
        // reflow during the morph.
        style={{ visibility: open ? "hidden" : "visible" }}
      >
        <IconLayoutList className="size-3 shrink-0" />
        <span className="truncate font-medium">{quote.name}</span>
        <span className="text-muted-foreground/80 tabular-nums">
          {itemCount} {itemCount === 1 ? "ítem" : "ítems"}
        </span>
      </m.button>

      <QuoteQuickViewPortal
        layoutId={layoutId}
        open={open}
        onClose={() => setOpen(false)}
        quote={quote}
        quoteId={quoteId}
      />
    </LazyMotion>
  );
}

interface QuoteQuickViewPortalProps {
  layoutId: string;
  open: boolean;
  onClose: () => void;
  quote: NonNullable<ReturnType<typeof useQuote>["data"]>;
  quoteId: string;
}

function QuoteQuickViewPortal({ layoutId, open, onClose, quote, quoteId }: QuoteQuickViewPortalProps) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <Scrim onClick={onClose} />
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <m.div
              layoutId={layoutId}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${layoutId}-title`}
              className="pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
              transition={{ duration: DURATION.base, ease: EASE_IN_OUT }}
            >
              <QuoteQuickViewContent quote={quote} quoteId={quoteId} onClose={onClose} titleId={`${layoutId}-title`} />
            </m.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Velo en CSS: con `motion`, un elemento que sólo anima opacidad parpadea al terminar. `usePresence` hace que AnimatePresence espere la salida. */
function Scrim({ onClick }: { onClick: () => void }) {
  const [isPresent, safeToRemove] = usePresence();
  return (
    <div
      aria-hidden
      onClick={onClick}
      onAnimationEnd={() => {
        if (!isPresent) safeToRemove?.();
      }}
      className={cn(
        "absolute inset-0 bg-black/50 ease-out fill-mode-forwards",
        isPresent ? "animate-in fade-in-0 duration-base" : "animate-out fade-out-0 duration-base",
      )}
    />
  );
}

interface QuoteQuickViewContentProps {
  quote: NonNullable<ReturnType<typeof useQuote>["data"]>;
  quoteId: string;
  onClose: () => void;
  titleId: string;
}

function QuoteQuickViewContent({ quote, quoteId, onClose, titleId }: QuoteQuickViewContentProps) {
  const itemCount = quote.itemCount;
  const items = quote.items.filter((item) => item.isSelected);
  const totalCash = quote.totals.cash;
  const totalCard = quote.totals.card;

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.08, duration: DURATION.fast, ease: EASE_OUT }}
      className="flex flex-col max-h-[80vh]"
    >
      <header className="flex items-start gap-3 p-5 border-b border-border/60">
        <div
          className="size-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-inset ring-white/10"
          style={{ background: getGradient(quote.id) }}
        >
          <IconLayoutList className="size-5 text-white/90 drop-shadow-sm" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 id={titleId} className="text-base font-semibold text-foreground truncate">
            {quote.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
            <span>
              {itemCount} {itemCount === 1 ? "componente" : "componentes"}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="size-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
        >
          <IconX className="size-4" />
        </button>
      </header>

      {quote.description && <p className="px-5 pt-3 text-sm text-muted-foreground line-clamp-3">{quote.description}</p>}

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
        {items.length ? (
          items.slice(0, 8).map((item) => {
            const price = item.offer?.priceCash ?? null;
            return (
              <div key={item.id} className="flex items-center gap-3 py-1.5">
                <div className="size-9 rounded-md overflow-hidden bg-secondary/40 shrink-0">
                  {item.product.imageUrl ? (
                    <AsyncImage
                      src={imageVariant(item.product.imageUrl, 400)}
                      alt=""
                      className="size-full object-contain"
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">{item.product.name}</div>
                  <div className="text-xs text-muted-foreground flex gap-x-2">
                    <span>{QUOTE_SLOT_LABELS[item.slot]}</span>
                    {item.quantity > 1 ? <span className="tabular-nums">x{item.quantity}</span> : null}
                  </div>
                </div>
                <div className="text-sm font-mono tabular-nums text-foreground shrink-0">
                  {price !== null ? formatCLP(price) : "—"}
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground italic py-2">Esta cotización está vacía.</p>
        )}
        {items.length > 8 && <p className="text-xs text-muted-foreground pt-1">+{items.length - 8} más…</p>}
      </div>

      <footer className="border-t border-border/60 p-4 space-y-3 bg-background/40">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Total efectivo</span>
          <span className="text-lg font-semibold font-mono tabular-nums text-foreground">{formatCLP(totalCash)}</span>
        </div>
        {totalCard > 0 && totalCard !== totalCash && (
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span>Total con tarjeta</span>
            <span className="font-mono tabular-nums">{formatCLP(totalCard)}</span>
          </div>
        )}
        <Link
          to={`/cotizacion/${quoteId}`}
          prefetch="intent"
          onClick={onClose}
          className={cn(
            "w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5",
            "bg-primary text-primary-foreground text-sm font-medium",
            "hover:bg-primary/90 transition-colors",
          )}
        >
          Ver cotización completa
          <IconArrowUpRight className="size-4" />
        </Link>
      </footer>
    </m.div>
  );
}
