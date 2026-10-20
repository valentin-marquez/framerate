import type { Category, QuoteCompatibility, QuoteDetail, QuoteItem, QuoteSlot } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import QuoteRoute from "~/features/quote/pages/quote-details";
import { Button } from "~/shared/components/primitives/button";
import { quoteKeys } from "~/shared/lib/query-keys";
import { sessions } from "~/shared/storybook/fixtures";
import { withQueryData } from "~/shared/storybook/with-query-data";
import { highEndCondense, lowEndCondense } from "./condense-options.fixtures";
import { CondenseStoresDialog } from "./condense-stores-dialog";
import { CreateQuoteDialog } from "./create-quote-dialog";
import { QuoteActions } from "./quote-actions";
import { CompatibilityList } from "./quote-compatibility";

const meta = { title: "Cotización/Página", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

const author = { username: "ana", displayName: "Ana Pérez", avatarUrl: null };

const img = (hash: string) => `https://cdn.framerate.cl/products/${hash}.webp`;

const store = (slug: string, name: string, icon: string | null) => ({
  slug,
  name,
  url: `https://${slug}.cl`,
  iconUrl: icon && `https://cdn.framerate.cl/stores/${slug}/icon-${icon}.webp`,
});
const STORES = [
  store("tectec", "TecTec", null),
  store("tekmachine", "Tekmachine", "1c0a913bd6"),
  store("myshop", "MyShop", "91cb99befc"),
  store("sandos", "Sandos", "88f1a78f7d"),
  store("tecnomas", "Tecnomas", "08e88b949e"),
];

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
          store: STORES[id % STORES.length],
          url: `https://${STORES[id % STORES.length].slug}.cl/p/${id}`,
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
const total = (pick: "priceCash" | "priceCard") =>
  items.reduce((sum, i) => (i.isSelected && i.offer ? sum + i.offer[pick] * i.quantity : sum), 0);

const quote: QuoteDetail = {
  id: "K7M2X9QPTV",
  name: "PC gamer 1440p",
  description: null,
  visibility: "public",
  itemCount: items.filter((i) => i.isSelected).length,
  likeCount: 12,
  likedByMe: false,
  author,
  createdAt: "2026-09-20T12:00:00.000Z",
  updatedAt: "2026-09-28T15:00:00.000Z",
  items,
  totals: { cash: total("priceCash"), card: total("priceCard") },
  compatibility,
};

/** El selector de tienda pide las ofertas del producto: aquí sólo la que ya trae la cotización. */
const offersOf = (detail: QuoteDetail): [readonly unknown[], unknown][] =>
  detail.items.flatMap((i) =>
    i.offer
      ? [
          [
            ["product-offers", i.product.slug],
            [{ ...i.offer, title: i.product.name, inStock: true, stockQuantity: null, lastSeenAt: detail.updatedAt }],
          ],
        ]
      : [],
  );

/** La página real, con la cotización como si viniera del loader. */
const page = (detail: QuoteDetail) => () => (
  <QuoteRoute {...({ loaderData: { quote: detail } } as unknown as Parameters<typeof QuoteRoute>[0])} />
);

const withPinned: QuoteDetail = {
  ...quote,
  description: "Para jugar en 1440p a más de 144 FPS. Ryzen 7 7800X3D y RTX 5070, con espacio para crecer.",
  items: quote.items.map((i) => (i.id === 1 ? { ...i, chosenListingId: i.offer?.id ?? null } : i)),
};

const visitor = { ...sessions.user, user: { ...sessions.user.user, username: "beto" } };

/** Toca la fila de la tarjeta de video para ver la alternativa guardada; el procesador tiene la tienda fijada a mano. */
export const Dueno: Story = {
  name: "Dueño con alternativas y una tienda fijada",
  parameters: { layout: "fullscreen", session: sessions.user },
  decorators: [withQueryData([...offersOf(withPinned), [quoteKeys.condense(quote.id), highEndCondense]])],
  render: page(withPinned),
};

export const Visitante: Story = {
  name: "Visitante",
  parameters: { layout: "fullscreen", session: visitor },
  render: page(withPinned),
};

const lowEndItems = [
  item(31, "cpu", "cpu", "AMD Ryzen 5 8600G", "AMD", 179_500, { specs: ["AM5", "6 núcleos", "65 W"] }),
  item(32, "motherboard", "motherboard", "ASUS PRIME A620M-K", "ASUS", 69_990, { specs: ["AM5", "DDR5", "mATX"] }),
  item(33, "ram", "ram", "Patriot Signature Line 8GB DDR5 5600 CL46", "Patriot", 129_990, {
    quantity: 2,
    specs: ["DDR5", "5600 MT/s"],
  }),
  item(34, "psu", "psu", "XPG Pylon 550W 80 Plus Bronze", "XPG", 47_790, { specs: ["550 W", "Bronze"] }),
  item(35, "case", "case", "GameMax Storm Black", "GameMax", 26_900, { specs: ["Hasta ATX"] }),
  item(36, "storage", "ssd", "Kingston NV3 500GB M.2 2280 NVMe PCIe 4.0", "Kingston", 69_900, {
    specs: ["500 GB", "NVMe"],
  }),
];
const lowEndTotal = (pick: "priceCash" | "priceCard") =>
  lowEndItems.reduce((sum, i) => (i.offer ? sum + i.offer[pick] * i.quantity : sum), 0);

export const GamaBaja: Story = {
  name: "Gama baja sin tarjeta de video",
  parameters: { layout: "fullscreen" },
  render: page({
    ...quote,
    id: "5JN27XNGZA",
    name: "PC de oficina y estudio",
    description: "Para clases, ofimática y videollamadas. Los gráficos integrados del Ryzen 5 8600G alcanzan.",
    itemCount: lowEndItems.length,
    items: lowEndItems,
    totals: { cash: lowEndTotal("priceCash"), card: lowEndTotal("priceCard") },
    compatibility: {
      status: "valid",
      estimatedWatts: 163,
      checks: [
        { rule: "socket", result: "ok", itemIds: [31, 32], message: "El procesador y la placa son AM5." },
        { rule: "memory_type", result: "ok", itemIds: [33, 32], message: "La RAM y la placa son DDR5." },
        { rule: "psu_wattage", result: "ok", itemIds: [34], message: "La fuente de 550 W cubre los 163 W estimados." },
      ],
    },
  }),
};

export const Vacia: Story = {
  name: "Cotización vacía del dueño",
  parameters: { layout: "fullscreen", session: sessions.user },
  render: page({
    ...quote,
    name: "Mi próximo PC",
    visibility: "private",
    itemCount: 0,
    likeCount: 0,
    items: [],
    totals: { cash: 0, card: 0 },
    compatibility: unchecked,
  }),
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

export const CondensarTiendas: Story = {
  name: "Condensar tiendas: gama alta",
  decorators: [withQueryData([[quoteKeys.condense(quote.id), highEndCondense]])],
  render: () => <CondenseStoresDialog quote={quote} onApply={async () => {}} defaultOpen />,
};

export const CondensarTiendasGamaBaja: Story = {
  name: "Condensar tiendas: gama baja, sin una tienda con todo",
  decorators: [withQueryData([[quoteKeys.condense(quote.id), lowEndCondense]])],
  render: () => <CondenseStoresDialog quote={quote} onApply={async () => {}} defaultOpen />,
};
