import * as cheerio from "cheerio";
import type { Category, CategoryMap } from "@/constants/categories";
import { BaseCrawler, type ProductData } from "./base";

/**
 * Mapeo de categorías Framerate a (categoría WC + atributo + valor) para WC Store API.
 * NotebooksYa agrupa los componentes en `partes-y-piezas-ya` (con attr `pa_producto-partes-y-piezas`)
 * y los discos en `almacenamiento-ya` (con attr `pa_producto-almacenamiento`).
 */
type CategoryConfig = { wcCategory: string; attribute?: string; attributeValue?: string };

const NOTEBOOKSYA_API_CONFIG: Record<Category, CategoryConfig[]> = {
  gpu: [
    { wcCategory: "partes-y-piezas-ya", attribute: "pa_producto-partes-y-piezas", attributeValue: "tarjeta-de-video" },
  ],
  cpu: [{ wcCategory: "partes-y-piezas-ya", attribute: "pa_producto-partes-y-piezas", attributeValue: "procesadores" }],
  motherboard: [
    { wcCategory: "partes-y-piezas-ya", attribute: "pa_producto-partes-y-piezas", attributeValue: "placa-madre" },
  ],
  ram: [
    {
      wcCategory: "partes-y-piezas-ya",
      attribute: "pa_producto-partes-y-piezas",
      attributeValue: "memoria-ram-para-pc",
    },
  ],
  psu: [
    { wcCategory: "partes-y-piezas-ya", attribute: "pa_producto-partes-y-piezas", attributeValue: "fuente-de-poder" },
  ],
  case: [{ wcCategory: "partes-y-piezas-ya", attribute: "pa_producto-partes-y-piezas", attributeValue: "gabinetes" }],
  ssd: [
    {
      wcCategory: "almacenamiento-ya",
      attribute: "pa_producto-almacenamiento",
      attributeValue: "unidad-de-estado-solido",
    },
  ],
  hdd: [
    { wcCategory: "almacenamiento-ya", attribute: "pa_producto-almacenamiento", attributeValue: "disco-duro-interno" },
  ],
  cpu_cooler: [],
  case_fan: [],
};

// Compat: mantenemos el mapa de URLs para cualquier import externo que aún lo espere.
export const NOTEBOOKSYA_CATEGORIES: CategoryMap<string[]> = {
  gpu: ["https://notebooksya.cl/product-category/partes-y-piezas-ya/?filter_producto-partes-y-piezas=tarjeta-de-video"],
  cpu: ["https://notebooksya.cl/product-category/partes-y-piezas-ya/?filter_producto-partes-y-piezas=procesadores"],
  motherboard: [
    "https://notebooksya.cl/product-category/partes-y-piezas-ya/?filter_producto-partes-y-piezas=placa-madre",
  ],
  ram: [
    "https://notebooksya.cl/product-category/partes-y-piezas-ya/?filter_producto-partes-y-piezas=memoria-ram-para-pc",
  ],
  psu: ["https://notebooksya.cl/product-category/partes-y-piezas-ya/?filter_producto-partes-y-piezas=fuente-de-poder"],
  case: ["https://notebooksya.cl/product-category/partes-y-piezas-ya/?filter_producto-partes-y-piezas=gabinetes"],
  ssd: [
    "https://notebooksya.cl/product-category/almacenamiento-ya/?filter_producto-almacenamiento=unidad-de-estado-solido",
  ],
  hdd: ["https://notebooksya.cl/product-category/almacenamiento-ya/?filter_producto-almacenamiento=disco-duro-interno"],
  cpu_cooler: [],
  case_fan: [],
};

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

export class NotebooksYaCrawler extends BaseCrawler<Category> {
  name = "NotebooksYa";
  baseUrl = "https://notebooksya.cl";

  // El sitio es WooCommerce y expone WC Store API público. Bun fetch directo funciona
  // (sin Cloudflare), así que no necesitamos Puppeteer para nada.
  protected useHeadless = false;
  protected concurrency = 4;
  private apiCache = new Map<string, WcStoreProduct>();

  async getAllProductUrlsForCategory(category: Category): Promise<string[]> {
    const configs = NOTEBOOKSYA_API_CONFIG[category] ?? [];
    if (configs.length === 0) {
      this.logger.warn(`No API config for category: ${category}`);
      return [];
    }

    const urls = new Set<string>();
    for (const cfg of configs) {
      const products = await this.fetchProducts(cfg);
      this.logger.info(`Category ${category} (${cfg.attributeValue ?? cfg.wcCategory}) → ${products.length} products`);
      for (const p of products) {
        if (!p.permalink || !p.name) continue;
        urls.add(p.permalink);
        this.apiCache.set(p.permalink, p);
      }
    }
    return [...urls];
  }

  /** Recorre WC Store API con paginación, filtrado por categoría + atributo si aplica. */
  private async fetchProducts(cfg: CategoryConfig): Promise<WcStoreProduct[]> {
    const all: WcStoreProduct[] = [];
    const perPage = 100;
    let page = 1;
    while (page <= 50) {
      const url = this.buildApiUrl(cfg, page, perPage);
      try {
        await this.waitRateLimit();
        this.logger.info(`Fetching API page ${page} of ${cfg.attributeValue ?? cfg.wcCategory}`);
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

  private buildApiUrl(cfg: CategoryConfig, page: number, perPage: number): string {
    const params = new URLSearchParams();
    params.set("category", cfg.wcCategory);
    params.set("per_page", String(perPage));
    params.set("page", String(page));
    if (cfg.attribute && cfg.attributeValue) {
      params.append("attributes[0][attribute]", cfg.attribute);
      params.append("attributes[0][slug]", cfg.attributeValue);
    }
    return `${this.baseUrl}/wp-json/wc/store/v1/products?${params.toString()}`;
  }

  /** Override fetchHtml: devolvemos JSON con la API data por URL (sin necesidad de HTML). */
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
      // Si nos llega HTML por compatibilidad, intentamos por slug.
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

    // Precios: API entrega cash y card por separado
    //   prices.price       = precio efectivo (= sale_price si on_sale, sino regular_price)
    //   prices.regular_price = precio normal (tarjeta/sin descuento)
    const cash = this.parseMoney(api.prices?.price);
    const regular = this.parseMoney(api.prices?.regular_price);
    const price = cash;
    const originalPrice = regular ?? cash;

    // Stock
    let stock = false;
    let stockQuantity: number | null = null;
    const stockText = api.stock_availability?.text ?? "";
    const stockClass = api.stock_availability?.class ?? "";
    if (api.is_in_stock || stockClass === "in-stock") {
      stock = true;
      const m = stockText.match(/(\d+)/);
      if (m) stockQuantity = Number.parseInt(m[1], 10);
      else if (api.low_stock_remaining != null) stockQuantity = api.low_stock_remaining;
    } else if (stockClass === "out-of-stock") {
      stock = false;
      stockQuantity = 0;
    }

    // Imagen
    const imageUrl = api.images?.[0]?.src ?? null;

    // MPN: SKU del producto (NotebooksYa usa MPN-style SKUs como "DUAL-RX9060XT-16G")
    const mpn = api.sku?.trim() || null;

    // Descripción
    const descriptionHtml = api.description ?? api.short_description ?? "";
    const descriptionText = descriptionHtml ? this.stripHtml(descriptionHtml) : "";

    // Marca: brands[] suele estar vacío; intentamos atributo `pa_marca-*` y luego del título.
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
    const brandAttr = attrs.find((a) => /pa_marca/i.test(a?.taxonomy ?? ""));
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

  /** Compatibilidad: extrae URLs desde HTML (sólo si alguien lo invoca; el flujo principal usa la API). */
  async getProductUrls(html: string): Promise<string[]> {
    const $ = cheerio.load(html);
    const urls = new Set<string>();
    $("ul.products li.product a.woocommerce-LoopProduct-link").each((_, a) => {
      const href = $(a).attr("href");
      if (href) urls.add(href);
    });
    return [...urls];
  }
}
