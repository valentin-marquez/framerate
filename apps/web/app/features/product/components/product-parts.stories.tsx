import type { PricePoint, QuoteSummary } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

const quote = (id: string, name: string, itemCount: number, visibility: QuoteSummary["visibility"]): QuoteSummary => ({
  id,
  name,
  description: null,
  visibility,
  itemCount,
  author: { username: "ana", displayName: "Ana Pérez", avatarUrl: null },
  createdAt: "2026-09-20T12:00:00.000Z",
  updatedAt: "2026-09-28T12:00:00.000Z",
});

// Sin sesión de API, el diálogo lee las cotizaciones de la caché: con staleTime infinito no sale a la red.
const clientWithQuotes = (items: QuoteSummary[]) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  client.setQueryData(quoteKeys.list(1, 50), { items, page: 1, pageSize: 50, total: items.length });
  return client;
};

const withQuotesClient = clientWithQuotes([
  quote("q-gamer", "PC gamer 2026", 8, "public"),
  quote("q-oficina", "Oficina de mamá", 1, "private"),
  quote("q-stream", "Streaming", 5, "public"),
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
