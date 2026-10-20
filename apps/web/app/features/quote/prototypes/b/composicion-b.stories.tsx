import type { Meta, StoryObj } from "@storybook/react-vite";
import { condensePlan, lowEnd, publicQuotes, withAlternatives } from "~/features/quote/prototypes/fixtures";
import { VitrinaCondensar } from "./vitrina-condensar";
import { VitrinaCotizacion } from "./vitrina-cotizacion";
import { VitrinaInicio } from "./vitrina-inicio";
import { VitrinaListado } from "./vitrina-listado";

const meta = { title: "Prototipos/Cotizaciones/B Vitrina" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** La placa madre con la tienda fijada a mano, para ver las dos marcas: "Más barato" y "Tienda elegida por ti". */
const owned = {
  ...withAlternatives,
  items: withAlternatives.items.map((i) =>
    i.slot === "motherboard" && i.offer ? { ...i, chosenListingId: i.offer.id } : i,
  ),
};

const content = "mx-auto w-full max-w-[1120px]";

/** La más querida en grande con su ficha al lado y una fila de cuatro; en teléfono, un carrusel que deja asomar la siguiente. */
export const Inicio: Story = {
  render: () => (
    <div className={content}>
      <VitrinaInicio quotes={publicQuotes} />
    </div>
  ),
};

/** Pestañas de periodo, el top 3 en tarjetas grandes y del 4 en adelante filas numeradas. */
export const Listado: Story = {
  render: () => (
    <div className={content}>
      <VitrinaListado quotes={publicQuotes} />
    </div>
  ),
};

/** Lista a dos tercios y resumen pegajoso como el de un carro de compras; en teléfono, barra fija abajo. */
export const Cotizacion: Story = {
  render: () => <VitrinaCotizacion quote={owned} isOwner plan={condensePlan} />,
};

export const CotizacionGamaBaja: Story = {
  render: () => <VitrinaCotizacion quote={lowEnd} isOwner={false} plan={condensePlan} />,
};

/** Conclusión arriba, "Ahora" contra "Condensado", el valor por tienda y los bloques por tienda. */
export const Condensar: Story = {
  render: () => <VitrinaCondensar quote={withAlternatives} plan={condensePlan} defaultOpen />,
};
