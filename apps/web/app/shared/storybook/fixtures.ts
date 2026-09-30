import type { ProductSummary } from "@framerate/contracts";
import type { CategoryWithCount } from "~/features/category/services/categories";
import { toProduct } from "~/features/product/services/adapters";
import type { ClaimableStore } from "~/features/stores/services/stores";

/** Datos de ejemplo para Storybook, con la forma real de la API (se pasan por los mismos adaptadores que el sitio). */

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
  lowestPrice: price,
  offerCount: 1,
  mpn: null,
});

export const products = [
  gpu(
    8,
    "Nvidia RTX 3050 | MSI Ventus 2X | 6GB GDDR6",
    "MSI",
    "2022/03/RTX-3050-MSI-Ventus-2X-6gb_1.jpg",
    "rtx 3050",
    6,
    279_990,
  ),
  gpu(
    1,
    "Nvidia RTX 5050 | 8GB VRAM | Zotac Twin Edge OC",
    "Zotac",
    "2026/09/RTX-5050-Zotac_1.png",
    "rtx 5050",
    8,
    379_990,
  ),
  gpu(
    3,
    "Nvidia RTX 5060 | 8GB GDDR7 | MSI Shadow 2X",
    "MSI",
    "2025/09/RTX-5070-MSI-Shadow-2x_1.png",
    "rtx 5060",
    8,
    449_990,
  ),
  gpu(
    4,
    "Nvidia RTX 5060 | 8GB GDDR6 | Asus Dual OC",
    "ASUS",
    "2025/07/RTX-5060-Asus-Dual_1.png",
    "rtx 5060",
    8,
    459_990,
  ),
].map(toProduct);

const category = (id: string, slug: string, name: string, count: number): CategoryWithCount => ({
  id,
  slug,
  name,
  code: id,
  created_at: "",
  product_count: count,
});

export const categories: CategoryWithCount[] = [
  category("gpu", "tarjetas-de-video", "Tarjetas de video", 8),
  category("cpu", "procesadores", "Procesadores", 0),
  category("motherboard", "placas-madre", "Placas madre", 0),
  category("ram", "memorias-ram", "Memorias RAM", 0),
  category("psu", "fuentes-de-poder", "Fuentes de poder", 0),
  category("ssd", "ssd", "SSD", 0),
];

export const stores: ClaimableStore[] = [
  { id: "tectec", slug: "tectec", name: "TecTec", icon_url: null, domain: "tectec.cl", is_claimed: false },
  { id: "dust2", slug: "dust2", name: "Dust2", icon_url: null, domain: "dust2.cl", is_claimed: true },
];

export const brands = [
  { name: "MSI", slug: "msi", count: 4 },
  { name: "ASUS", slug: "asus", count: 2 },
  { name: "Zotac", slug: "zotac", count: 2 },
];
