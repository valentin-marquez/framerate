import type { PublicQuote } from "@framerate/contracts";
import { imageVariant } from "@framerate/kit";
import { Link } from "react-router";
import { QuoteLikeToggle } from "~/features/quote/components/quote-like-toggle";
import { formatCLP } from "~/shared/utils/format";

export const QUOTE_GRID_A = "grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4";

/** Una foto grande (la primera, casi siempre el gabinete) y dos chicas apiladas, todas sobre el fondo de producto. */
function Collage({ images }: { images: string[] }) {
  const [big, ...small] = images;
  const cell = "grid min-h-0 place-items-center overflow-hidden rounded-xl bg-[var(--product-stage)]";
  const img = "size-full object-contain mix-blend-multiply";
  return (
    <div aria-hidden className="grid aspect-[4/3] grid-cols-[2fr_1fr] grid-rows-2 gap-1 p-1">
      <div className={`${cell} row-span-2 p-2`}>
        {big && <img src={imageVariant(big, 400)} alt="" loading="lazy" className={img} />}
      </div>
      {[0, 1].map((i) => (
        <div key={i} className={`${cell} p-1.5`}>
          {small[i] && <img src={imageVariant(small[i], 400)} alt="" loading="lazy" className={img} />}
        </div>
      ))}
    </div>
  );
}

interface QuoteCardAProps {
  quote: PublicQuote;
  /** Puesto por me gusta; sin él no se muestra rótulo. */
  rank?: number;
}

export function QuoteCardA({ quote, rank }: QuoteCardAProps) {
  return (
    <article className="group relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-foreground/15">
      <div className="relative">
        <Collage images={quote.images} />
        {rank !== undefined && (
          <span className="absolute top-2.5 left-2.5 rounded-md bg-card/90 px-1.5 py-0.5 text-label-xs text-muted-foreground tabular-nums">
            #{rank}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 px-3 pt-2 pb-3">
        <h3 className="line-clamp-2 text-label-sm text-foreground">
          {/* El enlace cubre la tarjeta (::after); el me gusta queda por encima. */}
          <Link
            to={`/cotizacion/${quote.id}`}
            prefetch="intent"
            className="after:absolute after:inset-0 after:z-[1] after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {quote.name}
          </Link>
        </h3>
        {/* PublicQuote no trae los nombres del procesador ni de la tarjeta: van el autor y la cantidad. */}
        <p className="truncate text-muted-foreground text-paragraph-xs">@{quote.author.username}</p>
        <p className="truncate text-muted-foreground text-paragraph-xs">
          {quote.itemCount} {quote.itemCount === 1 ? "componente" : "componentes"}
        </p>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-border border-t px-3 py-2">
        <span className="min-w-0 truncate text-label-sm text-foreground tabular-nums">
          {formatCLP(quote.totalCash)}
        </span>
        <span className="relative z-10 shrink-0">
          <QuoteLikeToggle quote={quote} />
        </span>
      </div>
    </article>
  );
}
