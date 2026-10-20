import type { QuoteDetail } from "@framerate/contracts";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "~/shared/hooks/use-translation";

interface QuoteHeaderProps {
  quote: Pick<QuoteDetail, "name" | "description" | "author" | "updatedAt">;
  /** Va junto al autor y la fecha (el me gusta). */
  children?: ReactNode;
  /** Va a la derecha en escritorio (Compartir y "Guardar como"). */
  actions?: ReactNode;
}

/** Título, autor, fecha y acciones en una línea, con la descripción debajo; en teléfono, una columna centrada. */
export function QuoteHeader({ quote, children, actions }: QuoteHeaderProps) {
  const { t } = useTranslation();
  const { author } = quote;

  return (
    <header className="flex flex-col items-center gap-2 text-center lg:flex-row lg:flex-wrap lg:gap-x-4 lg:text-left">
      <h1 className="order-1 min-w-0 text-foreground text-title-h5 md:text-title-h4">{quote.name}</h1>
      {quote.description && (
        <p className="order-2 max-w-2xl text-muted-foreground text-paragraph-sm lg:order-4 lg:basis-full">
          {quote.description}
        </p>
      )}
      <div className="order-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-label-xs text-muted-foreground lg:order-2">
        <Link to={`/u/${author.username}`} className="flex items-center gap-1.5 hover:text-foreground">
          {author.avatarUrl && (
            <img src={author.avatarUrl} alt="" className="size-5 rounded-full" referrerPolicy="no-referrer" />
          )}
          @{author.username}
        </Link>
        <span>
          {t("updated_on", {
            // react-doctor-disable-next-line rendering-hydration-mismatch-time -- timezone-stabilized output (es-CL, America/Santiago)
            date: new Date(quote.updatedAt).toLocaleDateString("es-CL", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "America/Santiago",
            }),
          })}
        </span>
        {children}
      </div>
      {actions && <div className="order-4 flex items-center gap-2 lg:order-3 lg:ml-auto">{actions}</div>}
    </header>
  );
}
