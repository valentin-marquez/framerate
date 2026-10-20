import type { QuoteDetail } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router";
import { condensePlan, highEnd, lowEnd, publicQuotes, withAlternatives } from "~/features/quote/prototypes/fixtures";
import { buttonVariants } from "~/shared/components/primitives/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/shared/components/primitives/select";
import { cn } from "~/shared/lib/utils";
import { sessions } from "~/shared/storybook/fixtures";
import { CondenseA } from "./condense-a";
import { QUOTE_GRID_A, QuoteCardA } from "./quote-card-a";
import { QuotePageA } from "./quote-page-a";

const meta = { title: "Prototipos/Cotizaciones/A Catálogo" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** El ancho del contenido del sitio en escritorio (1440 menos la barra lateral y el padding). */
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto w-full max-w-[1120px]">{children}</div>
);

const owner = { ...sessions.user, user: { ...sessions.user.user, username: highEnd.author.username } };

/** La RAM con su tienda fijada a mano: esa fila no lleva "Más barato" y aparece "Más barato en todo". */
const ownerQuote: QuoteDetail = {
  ...withAlternatives,
  items: withAlternatives.items.map((i) => (i.slot === "ram" && i.offer ? { ...i, chosenListingId: i.offer.id } : i)),
};

export const Inicio: Story = {
  render: () => (
    <Frame>
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-foreground text-label-lg md:text-title-h6">Cotizaciones populares</h2>
          <Link to="/cotizaciones" className="shrink-0 text-label-sm text-muted-foreground hover:text-primary">
            Ver más
          </Link>
        </div>
        <ol className={QUOTE_GRID_A}>
          {publicQuotes.slice(0, 4).map((quote, i) => (
            <li key={quote.id} className="flex min-w-0">
              <QuoteCardA quote={quote} rank={i === 0 ? 1 : undefined} />
            </li>
          ))}
        </ol>
      </section>
    </Frame>
  ),
};

const SORTS = [
  { value: "likes", label: "Más me gusta" },
  { value: "recent", label: "Más recientes" },
];

function Listing() {
  const [sort, setSort] = useState("likes");
  const quotes =
    sort === "recent"
      ? [...publicQuotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : [...publicQuotes].sort((a, b) => b.likeCount - a.likeCount);
  const page = 1;
  const pages = [1, 2, 3, 4];
  const pageLink = (current = false) =>
    cn(buttonVariants({ variant: current ? "default" : "ghost", size: "icon-sm" }), "tabular-nums");

  return (
    <div className="space-y-5 pb-16">
      <header className="space-y-1 pt-4">
        <h1 className="text-foreground text-title-h5 md:text-title-h4">Cotizaciones</h1>
        <p className="text-muted-foreground text-paragraph-sm md:text-paragraph-md">
          Armados públicos de la comunidad, con sus precios de hoy en tiendas chilenas.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 border-border border-y py-2.5">
        <p className="text-muted-foreground text-paragraph-sm tabular-nums">
          {quotes.length * pages.length} cotizaciones
        </p>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-paragraph-sm">Ordenar por</span>
          <Select value={sort} onValueChange={(value) => setSort(value as string)}>
            <SelectTrigger size="sm" aria-label="Ordenar cotizaciones">
              <SelectValue>{(value: string) => SORTS.find((s) => s.value === value)?.label ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ol className={QUOTE_GRID_A}>
        {quotes.map((quote, i) => (
          <li key={quote.id} className="flex min-w-0">
            <QuoteCardA quote={quote} rank={(page - 1) * quotes.length + i + 1} />
          </li>
        ))}
      </ol>

      <nav aria-label="Paginación" className="flex items-center justify-center gap-1 pt-2">
        <span aria-disabled className={cn(pageLink(), "pointer-events-none opacity-40")}>
          <IconChevronLeft />
        </span>
        {pages.map((n) => (
          <Link
            key={n}
            to={n === 1 ? "/cotizaciones" : `/cotizaciones?pagina=${n}`}
            aria-current={n === page ? "page" : undefined}
            className={pageLink(n === page)}
          >
            {n}
          </Link>
        ))}
        <Link to={`/cotizaciones?pagina=${page + 1}`} aria-label="Página siguiente" className={pageLink()}>
          <IconChevronRight />
        </Link>
      </nav>
    </div>
  );
}

export const Listado: Story = {
  render: () => (
    <Frame>
      <Listing />
    </Frame>
  ),
};

export const Cotizacion: Story = {
  parameters: { session: owner },
  render: () => (
    <Frame>
      <QuotePageA quote={ownerQuote} isOwner condensePlan={condensePlan} />
    </Frame>
  ),
};

export const CotizacionGamaBaja: Story = {
  parameters: { session: sessions.user },
  render: () => (
    <Frame>
      <QuotePageA quote={lowEnd} isOwner={false} />
    </Frame>
  ),
};

export const Condensar: Story = {
  parameters: { session: owner },
  render: () => <CondenseA quote={highEnd} plan={condensePlan} defaultOpen />,
};
