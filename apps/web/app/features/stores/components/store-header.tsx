import { IconCircleCheckFilled, IconExternalLink } from "@tabler/icons-react";
import { RatingStars } from "~/features/store-reviews/components/rating-stars";
import { OutboundLink } from "~/shared/components/outbound-link";
import { StoreLogo } from "~/shared/components/store-logo";
import { cn } from "~/shared/lib/utils";
import { getImageUrl } from "~/shared/utils/images";
import type { StoreDetail } from "../services/stores";

interface StoreHeaderProps {
  store: StoreDetail;
  /** Total de productos de la tienda en el catálogo (omitir si no se conoce). */
  productCount?: number;
}

/**
 * Etiqueta cualitativa estilo Steam para un promedio de estrellas (1-5).
 * Tono: verde (positivo), ámbar (mixto), rojo (negativo).
 */
function ratingLabel(average: number | null, count: number): { text: string; tone: string } {
  if (count === 0 || average === null) return { text: "Sin reseñas", tone: "text-muted-foreground" };
  if (average >= 4.5) return { text: "Excelentes", tone: "text-emerald-500" };
  if (average >= 4) return { text: "Muy buenas", tone: "text-emerald-500" };
  if (average >= 3) return { text: "Buenas", tone: "text-amber-500" };
  if (average >= 2) return { text: "Regulares", tone: "text-amber-500" };
  return { text: "Malas", tone: "text-red-500" };
}

/** Una fila del desglose: "Reseñas recientes — Muy buenas (8)". */
function ReviewSummaryRow({ label, average, count }: { label: string; average: number | null; count: number }) {
  const { text, tone } = ratingLabel(average, count);
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="flex items-center gap-1.5 text-xs">
        <span className={cn("font-medium", tone)}>{text}</span>
        {count > 0 && <span className="text-muted-foreground tabular-nums">({count})</span>}
      </dd>
    </div>
  );
}

/** Panel de reseñas estilo Steam: promedio + desglose reciente/general. */
function StoreReviewPanel({ rating }: { rating: StoreDetail["rating"] }) {
  if (rating.count === 0 || rating.average === null) {
    return (
      <div className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-secondary/30 p-4 text-center sm:w-60">
        <RatingStars value={0} size="sm" />
        <p className="font-medium text-foreground text-xs">Sin reseñas todavía</p>
        <p className="text-muted-foreground text-xs">Sé el primero en opinar de esta tienda.</p>
      </div>
    );
  }

  // `recent` puede faltar si una respuesta vieja del API quedó cacheada (TTL 1h)
  // de antes de agregar el campo — degradamos a vacío en vez de romper.
  const recent = rating.recent ?? { average: null, count: 0 };

  return (
    <div className="flex shrink-0 flex-col gap-3 rounded-xl border border-border/60 bg-secondary/30 p-4 sm:w-60">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-3xl text-foreground leading-none tabular-nums">
          {rating.average.toFixed(1)}
        </span>
        <div className="flex flex-col gap-1">
          <RatingStars value={rating.average} size="sm" />
          <span className="text-muted-foreground text-xs">
            {rating.count} {rating.count === 1 ? "reseña" : "reseñas"} en total
          </span>
        </div>
      </div>
      <dl className="flex flex-col gap-1.5 border-border/60 border-t pt-3">
        <ReviewSummaryRow label="Reseñas recientes" average={recent.average} count={recent.count} />
        <ReviewSummaryRow label="Reseñas generales" average={rating.average} count={rating.count} />
      </dl>
    </div>
  );
}

export function StoreHeader({ store, productCount }: StoreHeaderProps) {
  return (
    <header className="overflow-hidden rounded-2xl border border-border bg-card">
      {store.banner_url ? (
        <div
          className="h-40 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${getImageUrl(store.banner_url)})` }}
          aria-hidden
        />
      ) : (
        <div className="h-24 w-full bg-gradient-to-br from-primary/10 via-secondary/30 to-transparent" aria-hidden />
      )}
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <StoreLogo store={store} className="size-16 shrink-0 rounded-xl" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-2xl">{store.name}</h1>
              {store.verified_at && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs"
                  // react-doctor-disable-next-line rendering-hydration-mismatch-time -- timezone-stabilized output (es-CL, America/Santiago)
                  title={`Verificada el ${new Date(store.verified_at).toLocaleDateString("es-CL", {
                    timeZone: "America/Santiago",
                  })}`}
                >
                  <IconCircleCheckFilled className="size-3.5" />
                  Verificada
                </span>
              )}
            </div>
            {store.description && <p className="mt-1 max-w-2xl text-muted-foreground text-sm">{store.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
              {productCount !== undefined && productCount > 0 && (
                <span className="font-medium text-foreground">
                  {productCount} {productCount === 1 ? "producto" : "productos"}
                </span>
              )}
              {store.website && (
                <OutboundLink
                  href={store.website}
                  source="store_page"
                  storeId={store.id}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <IconExternalLink className="size-3.5" />
                  {new URL(store.website).hostname}
                </OutboundLink>
              )}
              {store.member_count > 0 && (
                <span>
                  {store.member_count} {store.member_count === 1 ? "miembro" : "miembros"}
                </span>
              )}
            </div>
          </div>
        </div>

        <StoreReviewPanel rating={store.rating} />
      </div>
    </header>
  );
}
