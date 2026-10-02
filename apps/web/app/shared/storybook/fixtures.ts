import { CATEGORY_LABELS, CATEGORY_SLUGS, type CategoryItem, type Me, type ProductSummary } from "@framerate/contracts";
import type { Profile } from "~/features/profile/services/profiles";
import type { ClaimableStore } from "~/features/stores/services/stores";

/** Datos de ejemplo para Storybook, con la forma real de la API. */

const gpu = (
  id: number,
  name: string,
  brand: string,
  image: string,
  chipset: string,
  vram: number,
  price: number,
): ProductSummary => ({
  id,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  name,
  brand,
  category: "gpu",
  imageUrl: `https://tectec.cl/wp-content/uploads/${image}`,
  attributes: { chipset, vram },
  bestPrice: price,
  bestCardPrice: price,
  lowestPrice: price,
  offerCount: 1,
  mpn: null,
});

export const products = [
  gpu(
    8,
    "Nvidia RTX 3050 MSI Ventus 2X 6GB GDDR6",
    "MSI",
    "2022/03/RTX-3050-MSI-Ventus-2X-6gb_1.jpg",
    "rtx 3050",
    6,
    279_990,
  ),
  gpu(
    1,
    "Nvidia RTX 5050 8GB VRAM Zotac Twin Edge OC",
    "Zotac",
    "2026/09/RTX-5050-Zotac_1.png",
    "rtx 5050",
    8,
    379_990,
  ),
  gpu(
    3,
    "Nvidia RTX 5060 8GB GDDR7 MSI Shadow 2X",
    "MSI",
    "2025/09/RTX-5070-MSI-Shadow-2x_1.png",
    "rtx 5060",
    8,
    449_990,
  ),
  gpu(4, "Nvidia RTX 5060 8GB GDDR6 Asus Dual OC", "ASUS", "2025/07/RTX-5060-Asus-Dual_1.png", "rtx 5060", 8, 459_990),
];

const [base0, base1, , base3] = products;

/** Un producto por cada caso que la tarjeta debe resolver. Parten de los reales y se les cambia lo mínimo. */
export const productStates = {
  tarjetaDistinta: { ...base3, bestCardPrice: 489_990, offerCount: 2 },
  sinStock: { ...base1, bestPrice: null, bestCardPrice: null },
  normal: base0,
  fuenteDePoder: {
    id: 90,
    slug: "corsair-rm850e",
    name: "Fuente de poder Corsair RM850e 850W 80 Plus Gold Full Modular ATX 3.1",
    brand: "Corsair",
    category: "psu",
    imageUrl: null,
    attributes: { wattage: 850, efficiency: "gold" },
    bestPrice: 124_990,
    bestCardPrice: 129_990,
    lowestPrice: 124_990,
    offerCount: 4,
    mpn: null,
  },
  nombreLargo: {
    ...base0,
    name: "Tarjeta de video Nvidia GeForce RTX 3050 MSI Ventus 2X OC Edition 6GB GDDR6 128-bit PCIe 4.0 con ventilación doble",
  },
} satisfies Record<string, ProductSummary>;

export const cardCases: { label: string; product: ProductSummary; trending?: boolean }[] = [
  { label: "Precio tarjeta distinto", product: productStates.tarjetaDistinta, trending: true },
  { label: "Sin stock", product: productStates.sinStock },
  { label: "Normal", product: productStates.normal },
  { label: "Fuente, sin imagen", product: productStates.fuenteDePoder },
  { label: "Nombre largo", product: productStates.nombreLargo },
];

const category = (id: CategoryItem["id"], productCount: number): CategoryItem => ({
  id,
  slug: CATEGORY_SLUGS[id],
  label: CATEGORY_LABELS[id],
  productCount,
});

export const categories: CategoryItem[] = [
  category("gpu", 8),
  category("cpu", 0),
  category("motherboard", 0),
  category("ram", 0),
  category("psu", 0),
  category("ssd", 0),
];

export const stores: ClaimableStore[] = [
  { id: "tectec", slug: "tectec", name: "TecTec", icon_url: null, domain: "tectec.cl", is_claimed: false },
  { id: "dust2", slug: "dust2", name: "Dust2", icon_url: null, domain: "dust2.cl", is_claimed: true },
];

/** Ocho productos con id distinto, para filas y grillas que usan el id como clave. */
export const rowProducts = [...products, ...products.map((p) => ({ ...p, id: p.id + 100, slug: `${p.slug}-b` }))];

const me = (role: Me["role"]): Me => ({
  id: "u1",
  email: "ana@framerate.cl",
  username: "ana",
  displayName: "Ana",
  avatarUrl: null,
  bio: null,
  lang: "es",
  theme: "system",
  role,
  createdAt: "2026-01-01T00:00:00.000Z",
  ban: null,
});

const profile: Profile = {
  id: "u1",
  username: "ana",
  full_name: "Ana",
  avatar_url: null,
  bio: null,
  lang: "es",
  created_at: "",
  updated_at: "",
};

/** Para `parameters.session` (ver `.storybook/preview.tsx`). */
export const sessions = {
  user: { user: me("user"), profile },
  admin: { user: me("admin"), profile },
};

export const brands = [
  { name: "MSI", slug: "msi", count: 4 },
  { name: "ASUS", slug: "asus", count: 2 },
  { name: "Zotac", slug: "zotac", count: 2 },
];
