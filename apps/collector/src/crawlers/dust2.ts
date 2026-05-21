import type { Category, CategoryMap } from "@/constants/categories";
import { BaseCrawler, type ProductData } from "./base";

/**
 * Crawler de dust2.gg — WooCommerce con la WC Store API pública
 * (`/wp-json/wc/store/v1/products`). Sin Puppeteer: `fetch` directo a JSON.
 *
 * dust2.gg vende mucho más que componentes de PC (TCG, consolas, etc.); acá
 * sólo mapeamos las categorías hijas de "componentes-de-pc" relevantes para
 * Framerate. No vende GPUs ni ventiladores de gabinete → esas quedan vacías.
 */
export const DUST2_API_SLUGS: CategoryMap<string[]> = {
  gpu: [],
  cpu: ["procesadores"],
  motherboard: ["placas-madres"],
  ram: ["memorias-ram"],
  psu: ["fuentes-de-poder"],
  ssd: ["discos-m-2"],
  hdd: [],
  cpu_cooler: ["cooler-para-cpu", "refrigeracion-liquida"],
  case: ["gabinetes"],
  case_fan: [],
};

// Alias retro-compatible con el patrón de los demás crawlers.
export const DUST2_CATEGORIES = DUST2_API_SLUGS;

interface WcStoreProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  sku?: string;
  short_description?: string;
  description?: string;
  prices?: { price?: string; regular_price?: string; sale_price?: string };
  is_in_stock?: boolean;
  is_purchasable?: boolean;
  low_stock_remaining?: number | null;
  stock_availability?: { text?: string; class?: string };
  images?: { src: string }[];
  brands?: { name: string; slug: string }[];
  // biome-ignore lint/suspicious/noExplicitAny: shape varies
  attributes?: any[];
}

export class Dust2Crawler extends BaseCrawler<Category> {
  name = "Dust2";
  baseUrl = "https://dust2.gg";

  // WC Store API pública vía fetch directo. Sin navegador headless.
  protected useHeadless = false;
  protected concurrency = 4;
  private apiCache = new Map<string, WcStoreProduct>();

  async getAllProductUrlsForCategory(category: Category): Promise<string[]> {
    const slugs = DUST2_API_SLUGS[category];
    if (!slugs || slugs.length === 0) {
      this.logger.warn(`No category slugs configured for: ${category}`);
      return [];
    }

    const urls = new Set<string>();
    for (const slug of slugs) {
      const products = await this.fetchProductsByCategory(slug);
      this.logger.info(`Category "${slug}" returned ${products.length} products from API`);
      for (const p of products) {
        if (!p.permalink || !p.name) continue;
        urls.add(p.permalink);
        this.apiCache.set(p.permalink, p);
      }
    }
    return [...urls];
  }

  /** Recorre la WC Store API paginando hasta agotar (header `x-wp-totalpages`). */
  private async fetchProductsByCategory(categorySlug: string): Promise<WcStoreProduct[]> {
    const all: WcStoreProduct[] = [];
    const perPage = 100;
    let page = 1;
    while (page <= 50) {
      const url = `${this.baseUrl}/wp-json/wc/store/v1/products?category=${categorySlug}&per_page=${perPage}&page=${page}`;
      try {
        await this.waitRateLimit();
        this.logger.info(`Fetching API page ${page} of "${categorySlug}"`);
        const res = await fetch(url, { headers: { "User-Agent": this.userAgents[0], Accept: "application/json" } });
        if (!res.ok) {
          this.logger.warn(`API ${url} returned ${res.status}`);
          break;
        }
        const items = (await res.json()) as WcStoreProduct[];
        if (!Array.isArray(items) || items.length === 0) break;
        all.push(...items);
        const totalPages = Number(res.headers.get("x-wp-totalpages") || "1");
        if (page >= totalPages) break;
        page++;
      } catch (err) {
        this.logger.error(`Error fetching API ${url}: ${String(err)}`);
        break;
      }
    }
    return all;
  }

  /** Override fetchHtml: el "html" es el JSON de la API por URL de producto. */
  public async fetchHtml(url: string, _waitForSelector?: string): Promise<string> {
    await this.waitRateLimit();
    let api = this.apiCache.get(url) ?? null;
    if (!api) {
      const slug = url.match(/\/(?:producto|product)\/([^/]+)\/?/)?.[1];
      if (slug) api = await this.fetchProductBySlug(slug);
    }
    if (!api) throw new Error(`No API data for ${url}`);
    return JSON.stringify({ api });
  }

  private async fetchProductBySlug(slug: string): Promise<WcStoreProduct | null> {
    try {
      const res = await fetch(`${this.baseUrl}/wp-json/wc/store/v1/products?slug=${slug}`, {
        headers: { "User-Agent": this.userAgents[0], Accept: "application/json" },
      });
      if (!res.ok) return null;
      const arr = (await res.json()) as WcStoreProduct[];
      return arr?.[0] ?? null;
    } catch {
      return null;
    }
  }

  async parseProduct(content: string, url: string): Promise<ProductData | null> {
    let api: WcStoreProduct | null = null;
    try {
      api = JSON.parse(content)?.api ?? null;
    } catch {
      // ignore — el flujo principal pasa JSON
    }
    if (!api) {
      const slug = url.match(/\/(?:producto|product)\/([^/]+)\/?/)?.[1];
      if (slug) api = await this.fetchProductBySlug(slug);
    }
    if (!api) {
      this.logger.warn(`No API data for ${url}`);
      return null;
    }

    const title = api.name?.trim();
    if (!title) {
      this.logger.warn(`Missing title for ${url}`);
      return null;
    }

    const cash = this.parseMoney(api.prices?.price);
    const regular = this.parseMoney(api.prices?.regular_price);
    const price = cash;
    const originalPrice = regular ?? cash;

    // Stock: `is_in_stock` es el campo canónico de la WC Store API. Lo
    // confirmamos con la clase de `stock_availability`. La cantidad sale del
    // texto ("50 disponibles") o de `low_stock_remaining`.
    const stockClass = api.stock_availability?.class ?? "";
    const stockText = this.stripHtml(api.stock_availability?.text ?? "");
    const stock = api.is_in_stock === true || /\bin-stock\b/.test(stockClass);
    let stockQuantity: number | null = null;
    if (stock) {
      const m = stockText.match(/(\d+)/);
      if (m) stockQuantity = Number.parseInt(m[1], 10);
      else if (api.low_stock_remaining != null) stockQuantity = api.low_stock_remaining;
    } else {
      stockQuantity = 0;
    }

    const imageUrl = api.images?.[0]?.src ?? null;

    // MPN: SKU del producto (en dust2 suele ser el código de barras / EAN).
    let mpn: string | null = api.sku?.trim() || null;
    if (!mpn) {
      const slug = url.match(/\/(?:producto|product)\/([^/]+)/)?.[1];
      if (slug) mpn = `DUST2-${slug.toUpperCase()}`;
    }

    const descriptionHtml = api.description ?? api.short_description ?? "";
    const descriptionText = descriptionHtml ? this.stripHtml(descriptionHtml) : "";

    // Marca: brands[] suele venir vacío; intentamos atributo `pa_marca`, sino el título.
    const manufacturer =
      api.brands?.[0]?.name?.trim() ||
      this.extractBrandFromAttributes(api.attributes) ||
      this.extractManufacturer(title) ||
      "";
    const specs: Record<string, string> = {};
    if (manufacturer) specs.manufacturer = manufacturer;

    return {
      url,
      title,
      price,
      originalPrice,
      stock,
      stockQuantity,
      mpn,
      imageUrl,
      specs,
      context: { description_text: descriptionText, description_html: descriptionHtml },
    };
  }

  // biome-ignore lint/suspicious/noExplicitAny: shape varies
  private extractBrandFromAttributes(attrs: any[] | undefined): string | undefined {
    if (!Array.isArray(attrs)) return undefined;
    const brandAttr = attrs.find((a) => /pa_marca|pa_brand/i.test(a?.taxonomy ?? ""));
    return brandAttr?.terms?.[0]?.name?.trim() || undefined;
  }

  private extractManufacturer(title: string): string | undefined {
    const brands = [
      "Asus",
      "MSI",
      "Gigabyte",
      "ASRock",
      "Kingston",
      "Corsair",
      "Adata",
      "Western Digital",
      "WD",
      "Seagate",
      "Intel",
      "AMD",
      "Zotac",
      "PNY",
      "Galax",
      "Deepcool",
      "Cooler Master",
      "EVGA",
      "Seasonic",
      "Thermaltake",
      "Samsung",
      "Crucial",
      "XPG",
      "G.Skill",
      "Team",
      "Patriot",
      "SanDisk",
      "Lexar",
      "Noctua",
      "be quiet!",
      "Lian Li",
      "NZXT",
    ];
    const lowerTitle = title.toLowerCase();
    for (const brand of brands) {
      if (lowerTitle.includes(brand.toLowerCase())) return brand;
    }
    return undefined;
  }

  private parseMoney(s: string | undefined | null): number | null {
    if (!s) return null;
    const cleaned = String(s).replace(/[^\d]/g, "");
    if (!cleaned) return null;
    const n = Number.parseInt(cleaned, 10);
    return Number.isNaN(n) ? null : n;
  }

  private stripHtml(s: string): string {
    return s
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** Compatibilidad: extrae URLs de producto desde HTML (el flujo principal usa la API). */
  async getProductUrls(html: string): Promise<string[]> {
    const urls = new Set<string>();
    const re = /https?:\/\/dust2\.gg\/(?:producto|product)\/[a-zA-Z0-9\-_/]+/gi;
    const matches = html.match(re);
    if (matches) for (const u of matches) urls.add(u.split("#")[0]);
    return [...urls];
  }
}
