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
  "keyboard",
  "mouse",
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Se ingieren y responden por URL (`/categoria/:slug` y sus fichas), pero no se listan: ni menú, home, sitemap, MCP ni
 * listados sin categoría. Periféricos, hasta que se decida publicarlos (#229, #218).
 */
export const HIDDEN_CATEGORIES: ReadonlySet<Category> = new Set(["keyboard", "mouse"]);
export const LISTED_CATEGORIES = CATEGORIES.filter((c) => !HIDDEN_CATEGORIES.has(c));

/** Nombre visible en español (la audiencia es chilena). */
export const CATEGORY_LABELS: Record<Category, string> = {
  gpu: "Tarjetas de video",
  cpu: "Procesadores",
  motherboard: "Placas madre",
  ram: "Memoria RAM",
  psu: "Fuentes de poder",
  ssd: "Unidades de estado sólido (SSD)",
  hdd: "Discos duros (HDD)",
  cpu_cooler: "Refrigeración CPU",
  case: "Gabinetes",
  case_fan: "Ventiladores",
  keyboard: "Teclados",
  mouse: "Mouses",
};

/** Nombre para listas angostas (riel lateral): donde el visible no cabe, uno corto. */
export const CATEGORY_NAV_LABELS: Record<Category, string> = { ...CATEGORY_LABELS, ssd: "Unidades SSD" };

/**
 * Slug público en español para URLs (`/categoria/:slug`). Son los mismos que la
 * web ya publica: cambiarlos rompe enlaces indexados.
 */
export const CATEGORY_SLUGS: Record<Category, string> = {
  gpu: "tarjetas-de-video",
  cpu: "procesadores",
  motherboard: "placas-madre",
  ram: "memorias-ram",
  psu: "fuentes-de-poder",
  ssd: "ssd",
  hdd: "discos-duros",
  cpu_cooler: "coolers-cpu",
  case: "gabinetes",
  case_fan: "ventiladores",
  keyboard: "teclados",
  mouse: "mouses",
};

export function categoryFromSlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => CATEGORY_SLUGS[c] === slug);
}
