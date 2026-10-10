import type { Category, ProductDetail } from "@framerate/contracts";
import { formatCLP } from "~/shared/utils/format";

/** Precio a destacar: el mejor con stock, o el de la oferta más barata si nadie tiene (la API las ordena así). */
export const headlinePrice = (product: ProductDetail) => product.bestPrice ?? product.offers[0]?.priceCash ?? null;

/** Una oferta por tienda, sólo con stock, en el orden de la API (más barata primero). */
function inStockByStore(product: ProductDetail) {
  const seen = new Set<string>();
  return product.offers.filter((o) => o.inStock && !seen.has(o.store.slug) && seen.add(o.store.slug));
}

export function shareDescription(product: ProductDetail): string {
  const price = headlinePrice(product);
  const stores = inStockByStore(product).length;
  if (price === null || stores === 0) {
    return `${product.name}: precios, tiendas e historial en Chile. Ninguna tienda lo tiene en stock ahora.`;
  }
  const where = stores === 1 ? "1 tienda" : `${stores} tiendas`;
  return `${product.name} desde ${formatCLP(price)} por transferencia en ${where} con stock. Compara precios en Chile.`;
}

/** Discord markdown: lo que el nombre de un producto puede traer y rompería un enlace o un formato. */
const md = (text: string) => text.replace(/([\\*_~`|[\]()#>])/g, "\\$1");

/** "Placa madre de MSI": la categoría de un producto, en singular (las etiquetas del catálogo van en plural). */
const ONE: Record<Category, string> = {
  gpu: "Tarjeta de video",
  cpu: "Procesador",
  motherboard: "Placa madre",
  ram: "Memoria RAM",
  psu: "Fuente de poder",
  ssd: "Disco SSD",
  hdd: "Disco duro",
  cpu_cooler: "Refrigeración de CPU",
  case: "Gabinete",
  case_fan: "Ventilador",
};

const ACCENT = 0x171717;
/** Tope de Discord para el JSON, contando cada escape a su largo completo. */
export const DISCORD_EMBED_MAX_BYTES = 3000;
const MAX_STORES = 3;

/**
 * Tarjeta de Discord para la ficha (component embed): foto, mejor precio, las tiendas más baratas con stock y
 * botones. Si el JSON pasa el tope de bytes, se van quitando tiendas de la lista.
 */
export function discordEmbed(product: ProductDetail, origin: string) {
  const url = `${origin}/producto/${product.slug}`;
  const category = ONE[product.category];
  const offers = inStockByStore(product);
  const best = offers[0];
  const price = headlinePrice(product);

  const heading = [
    `## [${md(product.name)}](${url})`,
    product.brand ? `${category} de ${md(product.brand)}` : category,
  ];
  const priceLines =
    best && price !== null
      ? [
          `### ${formatCLP(price)}`,
          best.priceCard > best.priceCash
            ? `-# por transferencia, ${formatCLP(best.priceCard)} con tarjeta`
            : "-# precio con transferencia",
        ]
      : ["-# Ninguna tienda lo tiene en stock ahora"];
  const summary = { type: 10, content: [...heading, ...priceLines].join("\n") };

  const build = (shown: number) => {
    const list = offers.slice(0, shown).map((o) => `**${md(o.store.name)}** ${formatCLP(o.priceCash)}`);
    const rest = offers.length - shown;
    if (rest > 0) list.push(`-# y ${rest === 1 ? "1 tienda más" : `${rest} tiendas más`} con stock`);
    const components: object[] = [
      product.imageUrl
        ? { type: 9, components: [summary], accessory: { type: 11, media: { url: product.imageUrl } } }
        : summary,
    ];
    if (list.length > 0) {
      components.push({ type: 14 }, { type: 10, content: ["-# Mejores precios con stock", ...list].join("\n") });
    }
    const buttons = [{ type: 2, style: 5, label: "Ver en Framerate", url }];
    if (best) buttons.push({ type: 2, style: 5, label: `Ir a ${best.store.name}`.slice(0, 80), url: best.url });
    components.push({ type: 1, components: buttons });
    return { component: { type: 17, accent_color: ACCENT, components } };
  };

  for (let shown = Math.min(MAX_STORES, offers.length); shown > 0; shown--) {
    const embed = build(shown);
    if (byteLength(embed) <= DISCORD_EMBED_MAX_BYTES) return embed;
  }
  return build(0);
}

export const byteLength = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
