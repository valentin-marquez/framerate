import type { QuoteDetail } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { condensePlan, highEnd, lowEnd, publicQuotes, withAlternatives } from "~/features/quote/prototypes/fixtures";
import { sessions } from "~/shared/storybook/fixtures";
import { withQueryData } from "~/shared/storybook/with-query-data";
import { CondenseDialog } from "./condensar";
import { QuoteDense } from "./cotizacion";
import { QuoteRankList, QuoteTable } from "./ranking";

const meta = { title: "Prototipos/Cotizaciones/C Lista densa" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const owner = { ...sessions.user, user: { ...sessions.user.user, username: "nozztutos", displayName: "Valentin" } };

/** El selector de tienda pide las ofertas del producto: aquí sólo la que ya trae la cotización. */
const offersOf = (quote: QuoteDetail) =>
  withQueryData(
    quote.items.flatMap((i) =>
      i.offer
        ? [
            [
              ["product-offers", i.product.slug],
              [{ ...i.offer, title: i.product.name, inStock: true, stockQuantity: null, lastSeenAt: quote.updatedAt }],
            ],
          ]
        : [],
    ) as [readonly unknown[], unknown][],
  );

const Page = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto w-full max-w-[1120px]">{children}</div>
);

/** Ranking de cinco: en escritorio la 1 y la 2 a la izquierda, con foto grande y descripción; de la 3 a la 5 a la derecha. */
export const Inicio: Story = {
  render: () => (
    <Page>
      <QuoteRankList quotes={publicQuotes} />
    </Page>
  ),
};

/** Tabla con puesto, fotos, nombre y autor, componentes, total y me gusta; en teléfono, filas que se despliegan. */
export const Listado: Story = {
  render: () => (
    <Page>
      <QuoteTable quotes={publicQuotes} />
    </Page>
  ),
};

/** Vista del dueño: alternativas en la tarjeta de video (toca su fila) y "Condensar tiendas" en la barra de la lista. */
export const Cotizacion: Story = {
  parameters: { session: owner },
  decorators: [offersOf(withAlternatives)],
  render: () => (
    <Page>
      <QuoteDense quote={withAlternatives} isOwner condensePlan={condensePlan} />
    </Page>
  ),
};

export const CotizacionGamaBaja: Story = {
  render: () => (
    <Page>
      <QuoteDense quote={lowEnd} isOwner={false} />
    </Page>
  ),
};

export const Condensar: Story = {
  render: () => <CondenseDialog quote={highEnd} plan={condensePlan} defaultOpen />,
};
