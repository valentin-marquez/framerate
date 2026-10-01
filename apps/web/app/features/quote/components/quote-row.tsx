import type { ComponentProps } from "react";
import type { QuoteListItem } from "~/features/quote/services/quotes";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";
import { getGradient } from "~/shared/utils/gradients";

export const QUOTE_ROW_CLASS =
  "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-60";

interface QuoteRowProps extends ComponentProps<"button"> {
  quote: Pick<QuoteListItem, "id" | "name" | "is_public" | "quote_items">;
}

/** Una cotización en una lista: degradado, nombre, componentes y si es privada. `children` va a la derecha. */
export function QuoteRow({ quote, className, children, ...props }: QuoteRowProps) {
  const { t } = useTranslation();
  const count = quote.quote_items?.[0]?.count ?? 0;

  return (
    <button type="button" className={cn(QUOTE_ROW_CLASS, className)} {...props}>
      <span className="size-9 shrink-0 rounded-md" style={{ background: getGradient(quote.id) }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{quote.name}</span>
        <span className="flex gap-x-2 text-xs text-muted-foreground">
          <span>{t(count === 1 ? "quote_components_one" : "profile_components_count", { count })}</span>
          {!quote.is_public && <span>{t("quote_private")}</span>}
        </span>
      </span>
      {children}
    </button>
  );
}
