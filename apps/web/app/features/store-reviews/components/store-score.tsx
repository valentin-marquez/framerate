import type { Offer } from "@framerate/contracts";
import { IconStarFilled } from "@tabler/icons-react";
import { Link } from "react-router";
import { cn } from "~/shared/lib/utils";

interface StoreScoreProps {
  store: Offer["store"];
  /** Enlaza a las reseñas de la tienda; sin esto es sólo texto (dentro de un botón no puede haber un enlace). */
  link?: boolean;
  className?: string;
}

/** Nota de una tienda para las filas de oferta: estrella, promedio y total; sin reseñas, un texto apagado. */
export function StoreScore({ store, link, className }: StoreScoreProps) {
  const { rating } = store;
  if (!rating) return <span className={cn("shrink-0 text-muted-foreground/70 text-xs", className)}>Sin reseñas</span>;

  const average = rating.average.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const content = (
    <>
      <IconStarFilled aria-hidden className="size-3 text-amber-400" />
      <span className="font-medium text-foreground">{average}</span>
      <span className="text-muted-foreground">({rating.count})</span>
    </>
  );
  const shared = cn("inline-flex shrink-0 items-center gap-1 text-xs tabular-nums", className);
  const title = `${average} de 5 según ${rating.count} reseña${rating.count === 1 ? "" : "s"}`;

  if (!link) {
    return (
      <span title={title} className={shared}>
        {content}
      </span>
    );
  }
  return (
    <Link
      to={`/tiendas/${store.slug}/resenas`}
      title={title}
      className={cn(
        shared,
        "relative z-10 rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {content}
    </Link>
  );
}
