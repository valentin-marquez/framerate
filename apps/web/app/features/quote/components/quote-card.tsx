import type { PublicQuote } from "@framerate/contracts";
import { imageVariant } from "@framerate/kit";
import { Link } from "react-router";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { QuoteLikeToggle } from "./quote-like-toggle";

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

interface QuoteCardProps {
  quote: PublicQuote;
  /** Puesto en el ranking; sin él no lleva rótulo. */
  rank?: number;
}

/** La misma etiqueta que lleva `ProductCard` bajo el nombre (A520, MATX). */
const CHIP = "rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground";

const capacity = (gb: number) => (gb >= 1000 ? `${+(gb / 1000).toFixed(1)}TB` : `${gb}GB`);

/** Dos líneas de etiquetas: los dos componentes más importantes, cada uno con la RAM y el almacenamiento al lado. */
export function QuoteSpecs({ quote, spread = false }: { quote: PublicQuote; spread?: boolean }) {
  const totals = [quote.ramGb && `Ram ${capacity(quote.ramGb)}`, quote.storageGb && `Rom ${capacity(quote.storageGb)}`];
  const lines = [0, 1].flatMap((i) =>
    quote.highlights[i] || totals[i] ? [{ name: quote.highlights[i], total: totals[i] }] : [],
  );
  return lines.map(({ name, total }) => (
    <p key={name ?? total} className="flex min-w-0 items-center gap-1">
      {name && <span className={cn(CHIP, "min-w-0 truncate")}>{name}</span>}
      {total && <span className={cn(CHIP, "shrink-0 tabular-nums", spread && "ml-auto")}>{total}</span>}
    </p>
  ));
}

/** Cotización pública: collage, nombre, dos componentes con la RAM y el almacenamiento, y pie con total, autor y me gusta. */
export function QuoteCard({ quote, rank }: QuoteCardProps) {
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
        <QuoteSpecs quote={quote} spread />
      </div>
      {/* En teléfono, a dos columnas, el total va en su línea y debajo el autor con el me gusta: juntos se cortaba el total. */}
      <div className="mt-auto grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 border-border border-t px-3 py-2 sm:grid-cols-[auto_1fr_auto]">
        <span className="col-span-2 text-label-sm text-foreground tabular-nums sm:col-span-1">
          {formatCLP(quote.totalCash)}
        </span>
        <span className="min-w-0 truncate text-muted-foreground text-paragraph-xs sm:text-center">
          @{quote.author.username} con {quote.itemCount} {quote.itemCount === 1 ? "componente" : "componentes"}
        </span>
        <span className="relative z-10 shrink-0">
          <QuoteLikeToggle quote={quote} />
        </span>
      </div>
    </article>
  );
}
