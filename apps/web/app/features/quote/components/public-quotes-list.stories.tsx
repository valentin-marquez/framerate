import type { Meta, StoryObj } from "@storybook/react-vite";
import { publicQuotes } from "~/shared/storybook/fixtures";
import { PUBLIC_QUOTES_PAGE_SIZE, PublicQuotesList } from "./public-quotes-list";

const meta = { title: "Cotización/Listado", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Una página llena, de más a menos "me gusta": repite las cinco del inicio con otro id. */
const fullPage = Array.from({ length: PUBLIC_QUOTES_PAGE_SIZE }, (_, i) => {
  const quote = publicQuotes[i % publicQuotes.length];
  return { ...quote, id: `${quote.id}${i}`, likeCount: Math.max(0, 160 - i * 9) };
});

/** El top 3 en tarjetas (carrusel en teléfono) y del 4 al 18 en filas (composición B de #214, 20-10-2026). */
export const Pagina1: Story = {
  name: "Página 1",
  render: () => <PublicQuotesList page={1} quotes={fullPage} />,
};

/** Desde la página 2, todo en filas; la última página no lleva "Siguiente". */
export const Pagina2: Story = {
  name: "Página 2",
  render: () => <PublicQuotesList page={2} quotes={fullPage.slice(0, 7)} />,
};

export const SinCotizaciones: Story = {
  name: "Sin cotizaciones",
  render: () => <PublicQuotesList page={1} quotes={[]} />,
};
