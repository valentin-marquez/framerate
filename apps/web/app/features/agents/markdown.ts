import type { CategoryItem, ProductDetail, ProductPage } from "@framerate/contracts";
import { formatCLP } from "~/shared/utils/format";

/** Calidad (`q`) con la que `accept` pide un tipo; 0 si no lo pide. `*` no cuenta: sólo `text/markdown` explícito. */
function quality(accept: string, type: string): number {
  for (const part of accept.split(",")) {
    const [range, ...params] = part.trim().split(";");
    if (range?.trim().toLowerCase() !== type) continue;
    const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    const value = q ? Number(q.slice(2)) : 1;
    return Number.isNaN(value) ? 1 : value;
  }
  return 0;
}

/** ¿El cliente prefiere markdown? Sólo si lo pide explícitamente con más calidad que HTML (un navegador nunca lo hace). */
export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const markdown = quality(accept, "text/markdown");
  return markdown > 0 && markdown > quality(accept, "text/html");
}

const prices = (cash: number, card: number) => `${formatCLP(cash)} efectivo, ${formatCLP(card)} tarjeta`;

export function productMarkdown(product: ProductDetail, origin: string): string {
  const lines = [`# ${product.name}`, "", `Ficha: ${origin}/producto/${product.slug}`];
  if (product.brand) lines.push(`Marca: ${product.brand}`);
  if (product.mpn) lines.push(`Código del fabricante: ${product.mpn}`);
  if (product.bestPrice !== null && product.bestCardPrice !== null) {
    lines.push("", `Mejor precio: ${prices(product.bestPrice, product.bestCardPrice)}`);
  } else {
    lines.push("", "Sin stock en ninguna tienda por ahora.");
  }
  lines.push("", "## Dónde comprarlo");
  for (const offer of product.offers) {
    lines.push(
      `- [${offer.store.name}](${offer.url}): ${prices(offer.priceCash, offer.priceCard)}, ${offer.inStock ? "en stock" : "sin stock"}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export function categoryMarkdown(label: string, slug: string, page: ProductPage, origin: string): string {
  const lines = [
    `# ${label}`,
    "",
    `Los ${page.items.length} más populares de ${page.total} con stock. Catálogo completo con filtros: ${origin}/categoria/${slug}`,
    "",
  ];
  for (const item of page.items) {
    const price =
      item.bestPrice !== null && item.bestCardPrice !== null ? prices(item.bestPrice, item.bestCardPrice) : "sin stock";
    lines.push(`- [${item.name}](${origin}/producto/${item.slug}): ${price}`);
  }
  return `${lines.join("\n")}\n`;
}

export function homeMarkdown(categories: CategoryItem[], origin: string): string {
  const lines = [
    "# Framerate",
    "",
    "Comparador de precios de hardware para PC en Chile: precios y stock de más de 20 tiendas, con precio en efectivo y con tarjeta, en CLP.",
    "",
    "## Categorías",
  ];
  for (const category of categories) {
    lines.push(
      `- [${category.label}](${origin}/categoria/${category.slug}): ${category.productCount} productos con stock`,
    );
  }
  lines.push("", `Explorar todo: ${origin}/explorar`);
  return `${lines.join("\n")}\n`;
}
