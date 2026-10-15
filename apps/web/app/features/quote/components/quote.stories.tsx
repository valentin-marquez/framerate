import type { Category, QuoteCompatibility, QuoteDetail, QuoteItem, QuoteSlot } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "~/shared/components/primitives/button";
import { CreateQuoteDialog } from "./create-quote-dialog";
import { QuoteActions } from "./quote-actions";
import { CompatibilityBar, CompatibilityList } from "./quote-compatibility";
import { QuoteHeader } from "./quote-header";
import { QuoteItemsList } from "./quote-items-list";
import { QuoteTotals } from "./quote-totals";

const meta = { title: "Cotización/Piezas", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

const author = { username: "ana", displayName: "Ana Pérez", avatarUrl: null };

const img = (hash: string) => `https://cdn.framerate.cl/products/${hash}.webp`;

const item = (
  id: number,
  slot: QuoteSlot,
  category: Category,
  name: string,
  brand: string,
  priceCash: number | null,
  {
    isSelected = true,
    quantity = 1,
    specs = [],
    image = null,
  }: { isSelected?: boolean; quantity?: number; specs?: string[]; image?: string | null } = {},
): QuoteItem => ({
  id,
  slot,
  quantity,
  isSelected,
  note: null,
  chosenListingId: null,
  product: { id, slug: `producto-${id}`, name, brand, category, imageUrl: image && img(image) },
  offer:
    priceCash === null
      ? null
      : {
          id: id * 10,
          store: { slug: "tectec", name: "TecTec", url: "https://tectec.cl", iconUrl: null },
          url: `https://tectec.cl/p/${id}`,
          priceCash,
          priceCard: Math.round(priceCash * 1.05),
        },
  specs: isSelected ? specs : [],
});

const items = [
  item(1, "cpu", "cpu", "AMD Ryzen 7 7800X3D", "AMD", 389_990, {
    specs: ["AM5", "8 núcleos", "120 W"],
    image: "b8cc4a3bcbd86e31a93b7e2213d08fc6",
  }),
  item(7, "motherboard", "motherboard", "ASUS Prime B760M-A", "ASUS", 155_990, {
    specs: ["LGA1700", "DDR4", "mATX", "4 slots"],
    image: "412e6c86101100bbfb2a27f8233c1e73",
  }),
  item(4, "ram", "ram", "Kingston Fury Beast 16GB DDR5 5600 CL36", "Kingston", 69_990, {
    quantity: 2,
    specs: ["DDR5", "5600 MT/s"],
    image: "f5ed35c4a6c79d03a9bbf1609603c284",
  }),
  item(2, "gpu", "gpu", "ASUS Dual GeForce RTX 5070 12GB OC Edition", "ASUS", 649_990, {
    specs: ["12 GB", "250 W", "227 mm"],
    image: "ce0fa4e704c8f0779f93edb365aeb61b",
  }),
  item(3, "gpu", "gpu", "Sapphire Pulse RX 7800 XT 16GB", "Sapphire", 549_990, { isSelected: false }),
  item(6, "psu", "psu", "Corsair RM850e 850W 80PLUS Gold", "Corsair", null, {
    specs: ["850 W", "Gold", "Modular"],
    image: "80b7aefb73114f0cd2cd91e0d132e5e0",
  }),
  item(8, "case", "case", "Cougar CFV235", "Cougar", 99_970, {
    specs: ["Hasta mATX"],
    image: "c11d646b288a285e75492e99b5d889d9",
  }),
  item(5, "storage", "ssd", "Kingston NV3 1TB M.2 2280 NVMe PCIe 4.0 Gen4 x4", "Kingston", 54_990, {
    specs: ["1 TB", "NVMe", "PCIe 4.0"],
    image: "98ba956dc7f6208167f70eaa0127faba",
  }),
];

const compatibility: QuoteCompatibility = {
  status: "incompatible",
  estimatedWatts: 445,
  checks: [
    {
      rule: "socket",
      result: "incompatible",
      itemIds: [1, 7],
      message: "El procesador es AM5 y la placa LGA1700: no calzan.",
    },
    { rule: "memory_type", result: "incompatible", itemIds: [4, 7], message: "La RAM es DDR5 y la placa usa DDR4." },
    {
      rule: "cooler_missing",
      result: "warning",
      itemIds: [1],
      message: "El procesador no trae cooler: agrega uno a la cotización.",
    },
    {
      rule: "gpu_length",
      result: "unknown",
      itemIds: [2, 8],
      message: "No sabemos el largo máximo de tarjeta de Cougar CFV235.",
    },
    { rule: "memory_slots", result: "ok", itemIds: [4, 7], message: "Son 2 módulos y la placa tiene 4 slots." },
    { rule: "board_case", result: "ok", itemIds: [7, 8], message: "La placa MATX entra en el gabinete." },
    {
      rule: "psu_wattage",
      result: "ok",
      itemIds: [6, 1, 2],
      message: "La fuente de 850 W cubre los 445 W estimados.",
    },
  ],
};
const unchecked: QuoteCompatibility = { status: "unknown", checks: [], estimatedWatts: null };
const only = (status: QuoteCompatibility["status"], checks: QuoteCompatibility["checks"]) => ({
  ...compatibility,
  status,
  checks,
});

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
  compatibility,
};

const list = (isOwner: boolean) => (
  <QuoteItemsList
    quote={quote}
    isOwner={isOwner}
    onChangeQuantity={noop}
    onRemove={noop}
    onSelect={noop}
    onChooseOffer={noop}
  />
);
const summary = (
  <QuoteTotals
    totalNormal={quote.totals.card}
    totalCash={quote.totals.cash}
    hasOutOfStockItems
    compatibility={compatibility}
  >
    <QuoteActions block onExportPDF={noop} onExportExcel={noop} onCopyClipboard={noop} />
  </QuoteTotals>
);

/** La página a ancho real de escritorio: 1440 menos la barra lateral y el padding. */
export const Pagina: Story = {
  name: "Página completa: dueño",
  render: () => (
    <div className="mx-auto w-full max-w-[1120px] space-y-8">
      <QuoteHeader quoteName={quote.name} author={author} updatedAt={quote.updatedAt} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        <div className="min-w-0 lg:col-span-8">{list(true)}</div>
        <aside className="min-w-0 space-y-4 lg:col-span-4 lg:sticky lg:top-4">
          {summary}
          <CompatibilityList compatibility={compatibility} />
        </aside>
      </div>
    </div>
  ),
};

export const Cabecera: Story = {
  render: () => <QuoteHeader quoteName={quote.name} author={author} updatedAt={quote.updatedAt} />,
};

export const ListaVacia: Story = {
  name: "Lista de componentes vacía",
  render: () => (
    <div className="max-w-3xl">
      <QuoteItemsList
        quote={{ id: "q-vacia", name: "Cotización vacía", items: [], itemCount: 0 }}
        isOwner
        onChangeQuantity={noop}
        onRemove={noop}
        onSelect={noop}
        onChooseOffer={noop}
      />
    </div>
  ),
};

export const ListaDelDueno: Story = {
  name: "Lista de componentes: dueño",
  render: () => <div className="max-w-3xl">{list(true)}</div>,
};

export const ListaDeVisitante: Story = {
  name: "Lista de componentes: visitante",
  render: () => <div className="max-w-3xl">{list(false)}</div>,
};

export const Resumen: Story = {
  name: "Resumen con total",
  render: () => (
    <div className="grid max-w-3xl gap-4 sm:grid-cols-2 sm:items-start">
      {summary}
      <QuoteTotals totalNormal={1_289_970} totalCash={1_219_970} compatibility={unchecked}>
        <QuoteActions block onExportPDF={noop} onExportExcel={noop} onCopyClipboard={noop} />
      </QuoteTotals>
    </div>
  ),
};

export const CompatibilidadEstados: Story = {
  name: "Compatibilidad: barra en cada estado",
  render: () => (
    <div className="max-w-3xl space-y-3">
      <CompatibilityBar compatibility={compatibility} />
      <CompatibilityBar compatibility={only("warning", compatibility.checks.slice(2, 3))} />
      <CompatibilityBar compatibility={only("unknown", compatibility.checks.slice(3, 4))} />
      <CompatibilityBar compatibility={unchecked} />
      <CompatibilityBar
        compatibility={only(
          "valid",
          compatibility.checks.filter((c) => c.result === "ok"),
        )}
      />
    </div>
  ),
};

export const CompatibilidadDetalle: Story = {
  name: "Compatibilidad: detalle",
  render: () => (
    <div className="max-w-md">
      <CompatibilityList compatibility={compatibility} />
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
