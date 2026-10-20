import type { PublicQuote } from "@framerate/contracts";
import { IconChevronDown, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router";
import { QuoteLikeToggle } from "~/features/quote/components/quote-like-toggle";
import { Button } from "~/shared/components/primitives/button";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";

export const componentes = (n: number) => `${n} ${n === 1 ? "componente" : "componentes"}`;

/** Las primeras fotos del armado en cuadritos, sobre el mismo fondo que la foto de producto. */
export function Thumbs({ images, count = 2, className }: { images: string[]; count?: number; className?: string }) {
  return (
    <span className="flex shrink-0 gap-1">
      {Array.from({ length: count }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: posiciones fijas; una puede no tener foto
          key={i}
          className={cn(
            "grid size-9 place-items-center overflow-hidden rounded-md bg-[var(--product-stage)]",
            className,
          )}
        >
          {images[i] && (
            <img src={images[i]} alt="" loading="lazy" className="size-full object-contain p-0.5 mix-blend-multiply" />
          )}
        </span>
      ))}
    </span>
  );
}

function RankRow({ quote, rank, featured }: { quote: PublicQuote; rank: number; featured?: boolean }) {
  return (
    <li className="relative flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-secondary/40">
      <span className="w-5 shrink-0 text-center text-label-sm text-muted-foreground tabular-nums">{rank}</span>
      <Thumbs images={quote.images} className={featured ? "lg:size-14" : undefined} />
      <div className="min-w-0 flex-1">
        <Link
          to={`/cotizacion/${quote.id}`}
          prefetch="intent"
          className="line-clamp-2 text-foreground text-label-sm after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring sm:line-clamp-1"
        >
          {quote.name}
        </Link>
        <p className="truncate text-muted-foreground text-paragraph-xs">
          @{quote.author.username} <span className="tabular-nums">{componentes(quote.itemCount)}</span>
        </p>
        {featured && quote.description && (
          <p className="mt-0.5 hidden truncate text-muted-foreground text-paragraph-xs lg:block">{quote.description}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
        <span className="text-foreground text-label-sm tabular-nums">{formatCLP(quote.totalCash)}</span>
        <span className="relative z-10">
          <QuoteLikeToggle quote={quote} />
        </span>
      </div>
    </li>
  );
}

/**
 * Las cinco primeras como un ranking compacto. En escritorio, dos columnas de igual alto: la 1 y la 2 más altas (foto
 * grande y descripción) a la izquierda, de la 3 a la 5 a la derecha; en teléfono, una sola columna.
 */
export function QuoteRankList({ quotes }: { quotes: PublicQuote[] }) {
  const top = quotes.slice(0, 5);
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-foreground text-label-lg md:text-title-h6">Cotizaciones populares</h2>
        <Link
          to="/cotizaciones"
          prefetch="intent"
          className="shrink-0 font-medium text-muted-foreground text-sm transition-colors hover:text-primary"
        >
          Ver más
        </Link>
      </div>
      <div className="grid overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-2 lg:divide-x lg:divide-border">
        <ol className="divide-y divide-border">
          {top.slice(0, 2).map((q, i) => (
            <RankRow key={q.id} quote={q} rank={i + 1} featured />
          ))}
        </ol>
        <ol start={3} className="divide-y divide-border border-border border-t lg:border-t-0">
          {top.slice(2).map((q, i) => (
            <RankRow key={q.id} quote={q} rank={i + 3} />
          ))}
        </ol>
      </div>
    </section>
  );
}

const SORTS = {
  likes: { label: "Más me gusta", fn: (a: PublicQuote, b: PublicQuote) => b.likeCount - a.likeCount },
  recent: { label: "Más recientes", fn: (a: PublicQuote, b: PublicQuote) => b.createdAt.localeCompare(a.createdAt) },
  cheap: { label: "Menor total", fn: (a: PublicQuote, b: PublicQuote) => a.totalCash - b.totalCash },
  expensive: { label: "Mayor total", fn: (a: PublicQuote, b: PublicQuote) => b.totalCash - a.totalCash },
};
type SortKey = keyof typeof SORTS;

const SELECT_CLASS =
  "h-8 cursor-pointer rounded-md border border-border bg-card px-2 text-label-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring";

/** Fila de teléfono: puesto, foto, nombre y total, me gusta; el chevron despliega las cuatro fotos y los datos. */
function MobileRow({ quote, rank }: { quote: PublicQuote; rank: number }) {
  const [open, setOpen] = useState(false);
  const id = `cot-${quote.id}`;
  return (
    <li>
      <div className="flex items-center gap-2.5 px-3 py-2">
        <span className="w-5 shrink-0 text-center text-label-xs text-muted-foreground tabular-nums">{rank}</span>
        <Thumbs images={quote.images} count={1} />
        <div className="min-w-0 flex-1">
          <Link to={`/cotizacion/${quote.id}`} className="block truncate text-foreground text-label-sm">
            {quote.name}
          </Link>
          <span className="text-muted-foreground text-label-xs tabular-nums">{formatCLP(quote.totalCash)}</span>
        </div>
        <QuoteLikeToggle quote={quote} />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={open ? "Ocultar detalle" : "Ver detalle"}
          onClick={() => setOpen((v) => !v)}
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-secondary"
        >
          <IconChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <div id={id} className="space-y-2 px-3 pb-3 pl-10">
          <div className="grid grid-cols-4 gap-1">
            {quote.images.slice(0, 4).map((src) => (
              <span key={src} className="aspect-square overflow-hidden rounded-md bg-[var(--product-stage)]">
                <img src={src} alt="" loading="lazy" className="size-full object-contain p-1 mix-blend-multiply" />
              </span>
            ))}
          </div>
          <p className="text-muted-foreground text-paragraph-xs">
            @{quote.author.username} <span className="tabular-nums">{componentes(quote.itemCount)}</span>
          </p>
          {quote.description && <p className="text-foreground text-paragraph-xs">{quote.description}</p>}
        </div>
      )}
    </li>
  );
}

/** `/cotizaciones` como tabla: orden y cantidad arriba, paginación abajo. */
export function QuoteTable({ quotes }: { quotes: PublicQuote[] }) {
  const [sort, setSort] = useState<SortKey>("likes");
  const [pageSize, setPageSize] = useState(18);
  // El puesto es el del ranking por me gusta: no cambia al reordenar.
  const rankOf = new Map(quotes.map((q, i) => [q.id, i + 1]));
  const rows = [...quotes].sort(SORTS[sort].fn).slice(0, pageSize);

  return (
    <div className="w-full space-y-4 pb-16">
      <header className="space-y-1 pt-4">
        <h1 className="text-foreground text-title-h5 md:text-title-h4">Cotizaciones populares</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Las cotizaciones públicas con más me gusta, de más a menos.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-muted-foreground text-label-xs">
          Ordenar por
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={SELECT_CLASS}>
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-muted-foreground text-label-xs">
          Mostrar
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className={SELECT_CLASS}>
            {[18, 36, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          por página
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="hidden w-full text-left md:table">
          <thead className="border-border border-b text-muted-foreground text-label-xs">
            <tr>
              <th scope="col" className="w-12 px-3 py-2 text-center font-medium">
                Puesto
              </th>
              <th scope="col" className="w-24 px-3 py-2 font-medium">
                <span className="sr-only">Fotos</span>
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Nombre
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Componentes
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Total efectivo
              </th>
              <th scope="col" className="w-20 px-3 py-2 text-right font-medium">
                Me gusta
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((q) => (
              <tr key={q.id} className="transition-colors hover:bg-secondary/40">
                <td className="px-3 py-2 text-center text-label-sm text-muted-foreground tabular-nums">
                  {rankOf.get(q.id)}
                </td>
                <td className="px-3 py-2">
                  <Thumbs images={q.images} />
                </td>
                <td className="max-w-0 px-3 py-2">
                  <Link
                    to={`/cotizacion/${q.id}`}
                    prefetch="intent"
                    className="block truncate text-foreground text-label-sm hover:text-primary"
                  >
                    {q.name}
                  </Link>
                  <span className="block truncate text-muted-foreground text-paragraph-xs">@{q.author.username}</span>
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground text-paragraph-sm tabular-nums">
                  {q.itemCount}
                </td>
                <td className="px-3 py-2 text-right text-foreground text-label-sm tabular-nums">
                  {formatCLP(q.totalCash)}
                </td>
                <td className="px-3 py-2 text-right">
                  <QuoteLikeToggle quote={q} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <ol className="divide-y divide-border md:hidden">
          {rows.map((q) => (
            <MobileRow key={q.id} quote={q} rank={rankOf.get(q.id) ?? 0} />
          ))}
        </ol>
      </div>

      <nav className="flex items-center justify-between gap-3" aria-label="Paginación">
        <span className="text-muted-foreground text-label-xs tabular-nums">
          {rows.length} de {quotes.length} cotizaciones
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" disabled aria-label="Página anterior">
            <IconChevronLeft />
          </Button>
          <span
            aria-current="page"
            className="grid size-8 place-items-center rounded-md bg-secondary text-foreground text-label-xs tabular-nums"
          >
            1
          </span>
          <Button variant="ghost" size="icon-sm" disabled={quotes.length <= pageSize} aria-label="Página siguiente">
            <IconChevronRight />
          </Button>
        </div>
      </nav>
    </div>
  );
}
