import type { Meta, StoryObj } from "@storybook/react-vite";
import type { PriceHistoryResponse, PriceHistorySeries } from "~/features/product/services/products";
import { products, sessions } from "~/shared/storybook/fixtures";
import { AddToQuote } from "./add-to-quote";
import { PriceHistoryChart } from "./price-history-chart";
import { PsuBadge } from "./psu-badge";

const meta = { title: "Producto/Detalle", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const DAY = 86_400_000;
const START = Date.UTC(2026, 8, 1);

/** Serie de 30 días con una ondulación fija (sin azar, para que la historia sea estable). */
const series = (slug: string, name: string, base: number, drift: number, phase: number): PriceHistorySeries => ({
  store_slug: slug,
  store_name: name,
  store_logo_url: null,
  points: Array.from({ length: 30 }, (_, day) => {
    const price = Math.round((base + drift * day + Math.sin(day / 3 + phase) * 8_000) / 1_000) * 1_000 - 10;
    return {
      recorded_at: new Date(START + day * DAY).toISOString(),
      price_cash: price,
      price_normal: Math.round(price * 1.05),
    };
  }),
});

const history: PriceHistoryResponse = {
  days: 30,
  series: [
    series("tectec", "TecTec", 469_990, -900, 0),
    series("dust2", "Dust2", 479_990, -400, 1.5),
    series("pc-express", "PC Express", 489_990, 200, 3),
  ],
};

export const HistorialDePrecios: Story = {
  name: "Historial de precios",
  render: () => <PriceHistoryChart data={history} className="max-w-3xl" />,
};

export const HistorialUnaTienda: Story = {
  name: "Historial de precios: una tienda al alza",
  render: () => (
    <PriceHistoryChart
      data={{ days: 30, series: [series("tectec", "TecTec", 429_990, 1_200, 0)] }}
      className="max-w-3xl"
    />
  ),
};

export const HistorialVacio: Story = {
  name: "Historial de precios sin datos",
  render: () => (
    <div className="space-y-2">
      <PriceHistoryChart data={{ days: 30, series: [] }} />
      <p className="text-muted-foreground text-xs">Sin puntos el gráfico no se dibuja (devuelve null).</p>
    </div>
  ),
};

const CERTS = ["80 Plus", "80 Plus Bronze", "80 Plus Silver", "80 Plus Gold", "80 Plus Platinum", "80 Plus Titanium"];

export const SelloFuenteDePoder: Story = {
  name: "Sello 80 Plus",
  render: () => (
    <div className="flex flex-wrap items-end gap-4">
      {CERTS.map((cert) => (
        <div key={cert} className="flex flex-col items-center gap-2">
          <PsuBadge certification={cert} />
          <span className="text-muted-foreground text-xs">{cert}</span>
        </div>
      ))}
    </div>
  ),
};

export const AgregarACotizacion: Story = {
  name: "Agregar a cotización: visitante",
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <AddToQuote product={{ id: products[0].id ?? "" }} label="long" />
      <AddToQuote product={{ id: products[0].id ?? "" }} label="short" />
      <AddToQuote product={{ id: products[0].id ?? "" }} className="size-12 rounded-xl border border-border/60" />
    </div>
  ),
};

export const AgregarACotizacionConSesion: Story = {
  name: "Agregar a cotización: con sesión",
  // La API de cotizaciones está apagada (`QUOTES_API_ENABLED`): el modal queda sin cotizaciones para elegir.
  parameters: { session: sessions.user },
  render: AgregarACotizacion.render,
};
