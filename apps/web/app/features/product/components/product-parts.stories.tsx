import type { PricePoint } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { QuoteListItem } from "~/features/quote/services/quotes";
import { useQuoteInteractionStore } from "~/features/quote/store/quote-interaction";
import { quoteKeys } from "~/shared/lib/query-keys";
import { products, sessions } from "~/shared/storybook/fixtures";
import { AddToQuote, AddToQuoteDialog } from "./add-to-quote";
import { PriceHistoryChart } from "./price-history-chart";

const meta = { title: "Producto/Detalle", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const DAY = 86_400_000;
const START = Date.UTC(2026, 8, 1);

/** Serie de 30 días con una ondulación fija (sin azar, para que la historia sea estable). */
const series = (store: string, storeName: string, base: number, drift: number, phase: number): PricePoint[] =>
  Array.from({ length: 30 }, (_, day) => {
    const priceCash = Math.round((base + drift * day + Math.sin(day / 3 + phase) * 8_000) / 1_000) * 1_000 - 10;
    return {
      store,
      storeName,
      priceCash,
      priceCard: Math.round(priceCash * 1.05),
      inStock: true,
      observedAt: new Date(START + day * DAY).toISOString(),
    };
  });

const history = [
  ...series("tectec", "TecTec", 469_990, -900, 0),
  ...series("dust2", "Dust2", 479_990, -400, 1.5),
  ...series("pc-express", "PC Express", 489_990, 200, 3),
];

export const HistorialDePrecios: Story = {
  name: "Historial de precios",
  render: () => <PriceHistoryChart points={history} days={30} className="max-w-3xl" />,
};

export const HistorialUnaTienda: Story = {
  name: "Historial de precios: una tienda al alza",
  render: () => (
    <PriceHistoryChart points={series("tectec", "TecTec", 429_990, 1_200, 0)} days={30} className="max-w-3xl" />
  ),
};

export const HistorialVacio: Story = {
  name: "Historial de precios sin datos",
  render: () => (
    <div className="space-y-2">
      <PriceHistoryChart points={[]} days={30} />
      <p className="text-muted-foreground text-xs">Sin puntos el gráfico no se dibuja (devuelve null).</p>
    </div>
  ),
};

const quoteProduct = { id: products[0].id, name: products[0].name };

// Vacía mientras `QUOTES_API_ENABLED` sea false: `AddToQuote` no renderiza sin la API (#25).
export const AgregarACotizacion: Story = {
  name: "Agregar a cotización: botones",
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <AddToQuote product={quoteProduct} label="long" />
      <AddToQuote product={quoteProduct} label="short" />
      <AddToQuote product={quoteProduct} className="size-12 rounded-xl border border-border/60" />
    </div>
  ),
};

const quote = (id: string, name: string, count: number, is_public: boolean): QuoteListItem => ({
  id,
  name,
  description: null,
  is_public,
  compatibility_status: "unknown",
  estimated_wattage: null,
  last_analyzed_at: null,
  created_at: "2026-09-20T12:00:00Z",
  updated_at: "2026-09-28T12:00:00Z",
  quote_items: [{ count }],
});

// Sin API, el diálogo lee las cotizaciones de la caché: una query desactivada igual devuelve lo que hay ahí.
const clientWithQuotes = (data: QuoteListItem[]) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  client.setQueryData(quoteKeys.list(1, 50), { data, meta: { page: 1, limit: 50, total: data.length, totalPages: 1 } });
  return client;
};

const withQuotesClient = clientWithQuotes([
  quote("q-gamer", "PC gamer 2026", 8, true),
  quote("q-oficina", "Oficina de mamá", 1, false),
  quote("q-stream", "Streaming", 5, true),
]);
const emptyClient = clientWithQuotes([]);

const dialog = (client: QueryClient) => () => (
  <QueryClientProvider client={client}>
    <AddToQuoteDialog product={quoteProduct} closing={false} onClose={() => {}} onClosed={() => {}} />
  </QueryClientProvider>
);

export const DialogoConCotizaciones: Story = {
  name: "Agregar a cotización: con cotizaciones",
  parameters: { session: sessions.user },
  beforeEach: () => {
    useQuoteInteractionStore.setState({ lastSelectedQuoteId: "q-gamer" });
  },
  render: dialog(withQuotesClient),
};

export const DialogoSinCotizaciones: Story = {
  name: "Agregar a cotización: sin cotizaciones",
  parameters: { session: sessions.user },
  render: dialog(emptyClient),
};

export const DialogoVisitante: Story = {
  name: "Agregar a cotización: visitante",
  render: dialog(emptyClient),
};
