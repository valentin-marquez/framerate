import type { Category, QuoteDetail, QuoteItem, QuoteSlot } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "~/shared/components/primitives/button";
import { CreateQuoteDialog } from "./create-quote-dialog";
import { QuoteActions } from "./quote-actions";
import { QuoteHeader } from "./quote-header";
import { QuoteItemsList } from "./quote-items-list";
import { QuoteTotals } from "./quote-totals";

const meta = { title: "Cotización/Piezas", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

const author = { username: "ana", displayName: "Ana Pérez", avatarUrl: null };

const item = (
  id: number,
  slot: QuoteSlot,
  category: Category,
  name: string,
  brand: string,
  priceCash: number | null,
  { isSelected = true, quantity = 1 }: { isSelected?: boolean; quantity?: number } = {},
): QuoteItem => ({
  id,
  slot,
  quantity,
  isSelected,
  note: null,
  product: { id, slug: `producto-${id}`, name, brand, category, imageUrl: null },
  offer:
    priceCash === null
      ? null
      : {
          id: id * 10,
          store: { slug: "tectec", name: "TecTec", url: "https://tectec.cl" },
          url: `https://tectec.cl/p/${id}`,
          priceCash,
          priceCard: Math.round(priceCash * 1.05),
        },
});

const items = [
  item(1, "cpu", "cpu", "AMD Ryzen 7 7800X3D", "AMD", 389_990),
  item(2, "gpu", "gpu", "ASUS Dual RTX 4070 SUPER OC 12GB", "ASUS", 649_990),
  item(3, "gpu", "gpu", "Sapphire Pulse RX 7800 XT 16GB", "Sapphire", 549_990, { isSelected: false }),
  item(4, "ram", "ram", "Kingston Fury Beast 16GB DDR5 6000", "Kingston", 69_990, { quantity: 2 }),
  item(5, "storage", "ssd", "Kingston NV3 1TB NVMe", "Kingston", 54_990),
  item(6, "psu", "psu", "Corsair RM850e 850W 80 Plus Gold", "Corsair", null),
];

const total = (pick: "priceCash" | "priceCard") =>
  items.reduce((sum, i) => (i.isSelected && i.offer ? sum + i.offer[pick] * i.quantity : sum), 0);

const quote: QuoteDetail = {
  id: "K7M2X9QPTV",
  name: "PC gamer 1440p",
  description: null,
  visibility: "public",
  itemCount: items.filter((i) => i.isSelected).length,
  author,
  createdAt: "2026-09-20T12:00:00.000Z",
  updatedAt: "2026-09-28T15:00:00.000Z",
  items,
  totals: { cash: total("priceCash"), card: total("priceCard") },
};

export const Cabecera: Story = {
  render: () => <QuoteHeader quoteName={quote.name} author={author} updatedAt={quote.updatedAt} />,
};

export const ListaVacia: Story = {
  name: "Lista de componentes vacía",
  render: () => (
    <QuoteItemsList
      quote={{ items: [], itemCount: 0, totals: { cash: 0, card: 0 } }}
      isOwner
      onChangeQuantity={noop}
      onRemove={noop}
    />
  ),
};

export const ListaDelDueno: Story = {
  name: "Lista de componentes: dueño",
  render: () => <QuoteItemsList quote={quote} isOwner onChangeQuantity={noop} onRemove={noop} />,
};

export const ListaDeVisitante: Story = {
  name: "Lista de componentes: visitante",
  render: () => <QuoteItemsList quote={quote} isOwner={false} onChangeQuantity={noop} onRemove={noop} />,
};

export const Totales: Story = {
  render: () => (
    <div className="max-w-3xl space-y-4 overflow-hidden rounded-3xl border border-border/40 bg-card">
      <QuoteTotals totalNormal={1_289_970} totalCash={1_219_970} />
      <QuoteTotals totalNormal={1_289_970} totalCash={1_219_970} hasOutOfStockItems />
    </div>
  ),
};

export const Acciones: Story = {
  render: () => (
    <div className="h-48">
      <QuoteActions onExportPDF={noop} onExportExcel={noop} onCopyClipboard={noop} />
    </div>
  ),
};

export const CrearCotizacion: Story = {
  name: "Diálogo para crear cotización",
  render: () => <CreateQuoteDialog trigger={<Button>Nueva cotización</Button>} />,
};
