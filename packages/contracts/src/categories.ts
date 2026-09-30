import { z } from "zod";

/**
 * Categorías de producto que Framerate compara. Fuente única de verdad:
 * la base, la API, los adaptadores de tienda y la web usan esta lista.
 * Agregar una categoría acá obliga (vía tipos) a mapearla en cada adaptador.
 */
export const CATEGORIES = [
  "gpu",
  "cpu",
  "motherboard",
  "ram",
  "psu",
  "ssd",
  "hdd",
  "cpu_cooler",
  "case",
  "case_fan",
] as const;

export const CategorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof CategorySchema>;

/** Nombre visible en español (la audiencia es chilena). */
export const CATEGORY_LABELS: Record<Category, string> = {
  gpu: "Tarjetas de video",
  cpu: "Procesadores",
  motherboard: "Placas madre",
  ram: "Memoria RAM",
  psu: "Fuentes de poder",
  ssd: "Discos SSD",
  hdd: "Discos duros",
  cpu_cooler: "Refrigeración CPU",
  case: "Gabinetes",
  case_fan: "Ventiladores",
};

/** Slug público en español para URLs (`/categoria/:slug`). */
export const CATEGORY_SLUGS: Record<Category, string> = {
  gpu: "tarjetas-de-video",
  cpu: "procesadores",
  motherboard: "placas-madre",
  ram: "memoria-ram",
  psu: "fuentes-de-poder",
  ssd: "discos-ssd",
  hdd: "discos-duros",
  cpu_cooler: "refrigeracion-cpu",
  case: "gabinetes",
  case_fan: "ventiladores",
};

export function categoryFromSlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => CATEGORY_SLUGS[c] === slug);
}
