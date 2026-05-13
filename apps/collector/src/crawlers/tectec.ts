import type { Category, CategoryMap } from "@/constants/categories";
import { BaseCrawler, type ProductData } from "./base";

/**
 * Mapeo de categorías Framerate a slugs de la WC Store API.
 * TecTec no vende gabinetes ni ventiladores en categorías dedicadas, así que `case` y `case_fan`
 * quedan vacíos (antes `case` apuntaba al parent `componentes-para-pc` y scrapeaba TODO).
 */
export const TECTEC_API_SLUGS: CategoryMap<string[]> = {
  gpu: ["tarjetas-de-video"],
  cpu: ["procesadores"],
  motherboard: ["placas-madres"],
  ram: ["memoria-ram"],
  psu: ["fuentes-de-poder"],
  ssd: ["discos-estado-solido"],
  hdd: ["discos-duro"],
  cpu_cooler: ["refrigeracion-cpu"],
  case: [],
  case_fan: [],
};

// Alias retro-compatible para imports externos que aún esperen TECTEC_CATEGORIES.
export const TECTEC_CATEGORIES = TECTEC_API_SLUGS;

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
  stock_availability?: { text?: string; class?: string };
  low_stock_remaining?: number | null;
  images?: { src: string }[];
  brands?: { name: string; slug: string }[];
  // biome-ignore lint/suspicious/noExplicitAny: shape varies
  attributes?: any[];
}

export class TectecCrawler extends BaseCrawler<Category> {
  name = "Tectec";
  baseUrl = "https://tectec.cl";

  // WC Store API público + Bun fetch directo (sin Cloudflare). Sin Puppeteer.
  protected useHeadless = false;
  protected concurrency = 4;
  private apiCache = new Map<string, WcStoreProduct>();

  async getAllProductUrlsForCategory(category: Category): Promise<string[]> {
    const slugs = TECTEC_API_SLUGS[category];
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

  /** Recorre WC Store API paginando hasta agotar (header `x-wp-totalpages`). */
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

  /** Override fetchHtml: devolvemos JSON con la API data por URL. */
  public async fetchHtml(url: string, _waitForSelector?: string): Promise<string> {
    await this.waitRateLimit();
    let api = this.apiCache.get(url) ?? null;
    if (!api) {
      const slug = url.match(/\/producto\/([^/]+)\/?/)?.[1];
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
      // ignore — flujo principal pasa JSON
    }
    if (!api) {
      const slug = url.match(/\/producto\/([^/]+)\/?/)?.[1];
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

    // Precios: API entrega cash y card por separado.
    const cash = this.parseMoney(api.prices?.price);
    const regular = this.parseMoney(api.prices?.regular_price);
    const price = cash;
    const originalPrice = regular ?? cash;

    // Stock: stock_availability.text puede contener HTML ("<span>1 disponibles</span>")
    let stock = false;
    let stockQuantity: number | null = null;
    const stockText = this.stripHtml(api.stock_availability?.text ?? "");
    const stockClass = api.stock_availability?.class ?? "";
    if (api.is_in_stock || /\bin-stock\b/.test(stockClass)) {
      stock = true;
      const m = stockText.match(/(\d+)/);
      if (m) stockQuantity = Number.parseInt(m[1], 10);
      else if (api.low_stock_remaining != null) stockQuantity = api.low_stock_remaining;
    } else if (/\bout-of-stock\b/.test(stockClass)) {
      stock = false;
      stockQuantity = 0;
    }

    const imageUrl = api.images?.[0]?.src ?? null;

    // MPN: SKU del producto. Si no hay, fallback a slug-based.
    let mpn: string | null = api.sku?.trim() || null;
    if (!mpn) {
      const slug = url.match(/\/producto\/([^/]+)/)?.[1];
      if (slug) mpn = `TECTEC-${slug.toUpperCase()}`;
    }

    // Descripción
    const descriptionHtml = api.description ?? api.short_description ?? "";
    const descriptionText = descriptionHtml ? this.stripHtml(descriptionHtml) : "";

    // Marca: brands[] suele estar vacío; intentamos atributo `pa_marca` si existe; sino del título.
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
      "Nvidia",
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
      "HP",
      "HPE",
      "Dell",
      "Lenovo",
      "Sapphire",
      "PowerColor",
      "XFX",
      "Inno3D",
      "Palit",
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

  /**
   * Compatibilidad: extrae URLs desde HTML de una página de categoría
   * (sólo si alguien llama directamente con HTML; el flujo principal usa la API).
   */
  async getProductUrls(html: string): Promise<string[]> {
    const urls = new Set<string>();
    const re = /https?:\/\/tectec\.cl\/producto\/[a-zA-Z0-9\-_/]+/gi;
    const matches = html.match(re);
    if (matches) for (const u of matches) urls.add(u.split("#")[0]);
    return [...urls];
  }
}
