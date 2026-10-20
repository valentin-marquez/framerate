import type { QuoteDetail } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QuoteHeader } from "~/features/quote/components/quote-header";
import { QuoteItemsList } from "~/features/quote/components/quote-items-list";
import { QuoteTotals } from "~/features/quote/components/quote-totals";
import { highEnd } from "~/features/quote/prototypes/fixtures";
import { CondensarA } from "./condensar-a";
import { CondensarB } from "./condensar-b";
import { CondensarC } from "./condensar-c";
import { highEndOptions, lowEndOptions } from "./fixtures";

const meta = {
  title: "Prototipos/Condensar",
  parameters: {
    layout: "padded",
    viewport: {
      options: {
        telefono: { name: "Teléfono 390", styles: { width: "390px", height: "844px" }, type: "mobile" },
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const telefono = { viewport: { value: "telefono", isRotated: false } };
const noop = () => {};

/** La página de la cotización armada con sus piezas reales (sin la página, que pide sesión y servicios). */
function PaginaConB({ quote }: { quote: QuoteDetail }) {
  return (
    <div className="flex min-h-screen w-full justify-center p-4 md:p-8">
      <div className="w-full max-w-6xl space-y-4 pb-16">
        <QuoteHeader quote={quote} />
        <QuoteTotals quote={quote} />
        <CondensarB data={highEndOptions} />
        {/* Como visitante, para que no aparezca el botón actual de "Condensar tiendas": B lo reemplaza. */}
        <QuoteItemsList
          quote={quote}
          isOwner={false}
          onChangeQuantity={noop}
          onRemove={noop}
          onSelect={noop}
          onChooseOffer={noop}
          onChooseCheapest={noop}
          onCondense={async () => {}}
        />
      </div>
    </div>
  );
}

export const AEscritorio: Story = {
  name: "A Opciones en tarjetas (escritorio)",
  render: () => <CondensarA data={highEndOptions} defaultOpen />,
};

export const ATelefono: Story = {
  name: "A Opciones en tarjetas (teléfono)",
  globals: telefono,
  render: () => <CondensarA data={highEndOptions} defaultOpen />,
};

/** Gama baja: la RAM sólo está en UG Store, así que no hay opción de una tienda y se ve deshabilitada con su porqué. */
export const AGamaBaja: Story = {
  name: "A Opciones en tarjetas (gama baja)",
  render: () => <CondensarA data={lowEndOptions} defaultOpen />,
};

export const BEscritorio: Story = {
  name: "B Sección en la cotización (escritorio)",
  parameters: { layout: "fullscreen" },
  render: () => <PaginaConB quote={highEnd} />,
};

/** Toca el chip "Comprar en menos tiendas" bajo las cifras para abrir la hoja. */
export const BTelefono: Story = {
  name: "B Sección en la cotización (teléfono)",
  parameters: { layout: "fullscreen" },
  globals: telefono,
  render: () => <PaginaConB quote={highEnd} />,
};

export const CEscritorio: Story = {
  name: "C Perfiles con nombre (escritorio)",
  render: () => <CondensarC data={highEndOptions} defaultOpen />,
};

export const CTelefono: Story = {
  name: "C Perfiles con nombre (teléfono)",
  globals: telefono,
  render: () => <CondensarC data={highEndOptions} defaultOpen />,
};
