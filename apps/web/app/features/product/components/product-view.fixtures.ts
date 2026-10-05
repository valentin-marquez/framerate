import type { Offer, PricePoint, ProductDetail } from "@framerate/contracts";

/**
 * Ficha real de producción (ASUS Dual RX 9060 XT 16GB, 2026-10-02) con la forma de la API v2. Las fechas se calculan
 * desde que carga la historia, así "visto hace" y el historial siempre se ven recientes.
 */

const MIN = 60_000;
const DAY = 86_400_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const offer = (
  id: number,
  slug: string,
  name: string,
  priceCash: number,
  priceCard: number,
  inStock: boolean,
  seenMinutesAgo: number,
  stockQuantity: number | null = null,
): Offer => ({
  id,
  store: { slug, name, url: `https://${slug}.cl`, iconUrl: null },
  url: `https://${slug}.cl/producto/asus-dual-radeon-rx-9060-xt-16gb`,
  title: `ASUS Dual Radeon RX 9060 XT 16GB GDDR6 (${name})`,
  priceCash,
  priceCard,
  inStock,
  stockQuantity,
  lastSeenAt: ago(seenMinutesAgo * MIN),
});

const offers: Offer[] = [
  offer(1, "nuevatec", "Nuevatec", 533_520, 561_600, true, 18),
  offer(2, "myshop", "MyShop", 533_900, 563_265, true, 14),
  offer(3, "pc-express", "PC Express", 533_900, 567_979, true, 10, 2),
  offer(4, "cclink", "CCLink", 648_980, 681_429, true, 17),
  offer(5, "notebookstore", "Notebook Store", 658_802, 681_990, true, 0),
  offer(6, "tecnomas", "Tecnomas", 670_990, 687_990, true, 5),
  offer(7, "pcfactory", "PC Factory", 679_990, 700_990, true, 16),
  // La más barata no tiene stock: la ficha no filtra, la muestra al final.
  offer(8, "dust2", "Dust2", 532_990, 570_299, false, 24, 0),
];

export const product: ProductDetail = {
  id: 826,
  slug: "asus-dual-radeon-rx-9060-xt-16gb",
  name: "ASUS Dual Radeon RX 9060 XT 16GB",
  brand: "ASUS",
  category: "gpu",
  imageUrl:
    "https://dust2.gg/wp-content/uploads/2026/02/new-project-2026-02-23t171641294-33567d97-fa1b-4189-8699-47d27642ef2c.jpg",
  bestPrice: 533_520,
  bestCardPrice: 561_600,
  referencePrice: 589_990,
  mpn: "DUAL-RX9060XT-16G",
  attributes: { chipset: "rx 9060 xt", vram: 16, line: "dual", oc: false },
  offerCount: offers.length,
  offers,
};

/** Un punto por día y tienda, con una ondulación fija (sin azar, para que la historia sea estable). */
const series = (o: Offer, base: number, drift: number, phase: number, outFromDay = 99): PricePoint[] =>
  Array.from({ length: 30 }, (_, i) => {
    const day = 29 - i;
    const priceCash = Math.round((base + drift * i + Math.sin(i / 3 + phase) * 9_000) / 1_000) * 1_000 - 10;
    return {
      store: o.store.slug,
      storeName: o.store.name,
      priceCash,
      priceCard: Math.round(priceCash * 1.05),
      inStock: i < outFromDay,
      observedAt: ago(day * DAY + 3 * 60 * MIN),
    };
  });

export const history: PricePoint[] = [
  ...series(offers[0], 559_990, -900, 0),
  ...series(offers[2], 549_990, -500, 1.5),
  ...series(offers[3], 659_990, -300, 3),
  ...series(offers[6], 689_990, -200, 2),
  ...series(offers[7], 545_990, -450, 4, 27),
];

const noStock = offers.map((o) => ({ ...o, inStock: false, stockQuantity: 0 }));

export type ProductCase = { product: ProductDetail; history: PricePoint[] };

/** Los casos que cada propuesta tiene que resolver. */
export const cases = {
  normal: { product, history },
  sinEspecificaciones: { product: { ...product, attributes: {}, mpn: null }, history },
  sinHistorial: { product, history: [] },
  unaTienda: {
    product: { ...product, offers: [offers[6]], offerCount: 1, bestPrice: 679_990, bestCardPrice: 700_990 },
    history: history.filter((p) => p.store === "pcfactory"),
  },
  sinStock: {
    product: { ...product, offers: noStock, bestPrice: null, bestCardPrice: null },
    history: history.map((p) => (Date.parse(p.observedAt) > Date.now() - 5 * DAY ? { ...p, inStock: false } : p)),
  },
} satisfies Record<string, ProductCase>;
