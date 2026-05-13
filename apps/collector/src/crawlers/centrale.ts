import * as cheerio from "cheerio";
import type { Page } from "puppeteer";
import type { Category, CategoryMap } from "@/constants/categories";
import { BaseCrawler, type ProductData } from "./base";

/**
 * Mapeo de categorías a slugs de la WC Store API.
 * Centrale tiene categorías dedicadas para coolers de aire / refrigeración líquida / ventiladores,
 * así que no se necesitan filtros por atributo (a diferencia de SSD/HDD que sí comparten categoría).
 */
export const CENTRALE_API_SLUGS: CategoryMap<string[]> = {
  gpu: ["tarjetas-graficas-para-pc"],
  cpu: ["procesadores-para-pc"],
  motherboard: ["placas-madres-para-pc"],
  ram: ["memorias-ram-para-pc"],
  psu: ["fuentes-de-poder-para-pc"],
  case: ["gabinetes-para-pc"],
  ssd: ["almacenamiento-para-pc"],
  hdd: ["almacenamiento-para-pc"],
  cpu_cooler: ["coolers-de-aire", "refrigeracion-liquida"],
  case_fan: ["ventiladores"],
};

// Alias retro-compatible para imports externos (factory, rutas).
export const CENTRALE_CATEGORIES = CENTRALE_API_SLUGS;

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
  // biome-ignore lint/suspicious/noExplicitAny: API attributes shape varies
  attributes?: any[];
}

export class CentraleCrawler extends BaseCrawler<Category> {
  name = "Centrale";
  baseUrl = "https://centrale.cl";

  // Estrategia híbrida:
  //   - WC Store API entrega name, prices.price (cash), stock_availability, images, brand,
  //     description (sin auth, no bloqueado por CF en Bun fetch).
  //   - El HTML del PDP está protegido por Cloudflare + reemplaza precios y stock con
  //     placeholders animados <span class="cas-price-ph">; sólo lo usamos para extraer el MPN
  //     (que vive en <span id="solotodo" data-copy="...">).
  //   - fetchHtml devuelve un JSON combinado { html, api } que parseProduct interpreta.
  protected useHeadless = false;
  protected concurrency = 4;
  private warmupPage: Page | null = null;
  private apiCache = new Map<string, WcStoreProduct>();

  /** Abre (una sola vez) una página de Puppeteer y la navega a la home para obtener cookies CF. */
  private async getWarmupPage(): Promise<Page> {
    if (this.warmupPage && !this.warmupPage.isClosed()) return this.warmupPage;
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(this.userAgents[0]);
    this.logger.info("Warming up Centrale session (CF cookies)...");
    await page.goto(this.baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    this.warmupPage = page;
    return page;
  }

  /**
   * Devuelve un JSON combinado { html, api } que parseProduct parsea.
   * - html: PDP descargado en el browser context (cookies CF) — usado sólo para MPN.
   * - api: producto via WC Store API (precio, stock, imagen, marca, descripción).
   */
  public async fetchHtml(url: string, _waitForSelector?: string): Promise<string> {
    await this.waitRateLimit();
    this.logger.info(`Fetching: ${url}`);
    const slug = this.extractSlugFromUrl(url);
    const [html, api] = await Promise.all([this.fetchHtmlViaBrowser(url), this.fetchProductBySlug(slug)]);
    return JSON.stringify({ html: html ?? "", api: api ?? null });
  }

  private extractSlugFromUrl(url: string): string {
    const m = url.match(/\/producto\/([^/]+)\/?$/);
    return m?.[1] ?? "";
  }

  private async fetchHtmlViaBrowser(url: string): Promise<string | null> {
    const page = await this.getWarmupPage();
    return await page.evaluate(async (u) => {
      try {
        const r = await fetch(u, { headers: { Accept: "text/html,*/*" } });
        if (!r.ok) return null;
        return await r.text();
      } catch {
        return null;
      }
    }, url);
  }

  /** Fetch del WC Store API para un producto por slug. Usa cache si está disponible. */
  private async fetchProductBySlug(slug: string): Promise<WcStoreProduct | null> {
    if (!slug) return null;
    const permalink = `${this.baseUrl}/producto/${slug}/`;
    const cached = this.apiCache.get(permalink);
    if (cached) return cached;
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

  public async closeBrowser(): Promise<void> {
    this.warmupPage = null;
    await super.closeBrowser();
  }

  async getAllProductUrlsForCategory(category: Category): Promise<string[]> {
    const slugs = CENTRALE_API_SLUGS[category];
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
        if (this.shouldInclude(p.name, category)) {
          urls.add(p.permalink);
          this.apiCache.set(p.permalink, p);
        }
      }
    }
    return [...urls];
  }

  /** Recorre la WC Store API para obtener todos los productos (con paginación). */
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

  /**
   * almacenamiento-para-pc mezcla SSD/HDD/M.2; los discrimina por keywords del título.
   */
  private shouldInclude(title: string, category: Category): boolean {
    const t = title.toLowerCase();
    if (category === "ssd") {
      return /\bssd\b|nvme|m\.?2/.test(t) && !/\bhdd\b|disco\s+duro/.test(t);
    }
    if (category === "hdd") {
      return /\bhdd\b|disco\s+duro/.test(t) && !/\bssd\b|nvme|m\.?2/.test(t);
    }
    return true;
  }

  async parseProduct(content: string, url: string): Promise<ProductData | null> {
    let html = "";
    let api: WcStoreProduct | null = null;
    try {
      const parsed = JSON.parse(content);
      html = parsed.html ?? "";
      api = parsed.api ?? null;
    } catch {
      // Si llega HTML crudo (uso directo, sin pasar por fetchHtml), procesarlo igual.
      html = content;
    }

    // La API es la fuente principal de datos. Si falta, intentamos un último fallback.
    if (!api) {
      const slug = this.extractSlugFromUrl(url);
      api = await this.fetchProductBySlug(slug);
    }

    const title = api?.name?.trim() || this.extractTitleFromHtml(html) || "";
    if (!title) {
      this.logger.warn(`Missing title for ${url}`);
      return null;
    }

    // Precio: API entrega el cash (price = sale_price = regular_price para Centrale)
    const price = this.parseMoney(api?.prices?.price);
    const originalPrice = price; // Card price vive sólo en placeholders animados — sin acceso confiable.

    // Stock: API entrega texto legible "N disponibles" / "Sin stock"
    let stock = false;
    let stockQuantity: number | null = null;
    const stockClass = api?.stock_availability?.class ?? "";
    const stockText = api?.stock_availability?.text ?? "";
    if (api?.is_in_stock || stockClass === "in-stock") {
      stock = true;
      const m = stockText.match(/(\d+)/);
      if (m) stockQuantity = Number.parseInt(m[1], 10);
      else if (api?.low_stock_remaining != null) stockQuantity = api.low_stock_remaining;
    } else if (stockClass === "out-of-stock") {
      stock = false;
      stockQuantity = 0;
    }

    // Imagen: primera de api.images, fallback a og:image del HTML.
    const $ = cheerio.load(html);
    const imageUrl =
      api?.images?.[0]?.src ||
      $('meta[property="og:image:secure_url"]').attr("content") ||
      $('meta[property="og:image"]').attr("content") ||
      null;

    // MPN: sólo vive en el HTML PDP (span#solotodo[data-copy])
    const mpnEl = $("span#solotodo").first();
    const mpn =
      mpnEl.attr("data-copy") ||
      mpnEl.find(".pdp-value").text().trim() ||
      mpnEl.text().replace(/MPN:/i, "").trim() ||
      null;

    // Descripción: API entrega description (HTML rico).
    const descriptionHtml = api?.description ?? "";
    const descriptionText = descriptionHtml ? this.stripHtml(descriptionHtml) : "";

    // Marca: api.brands[0].name si existe; sino se extrae del título.
    const manufacturer = api?.brands?.[0]?.name?.trim() || this.extractManufacturer(title) || "";
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

  private extractTitleFromHtml(html: string): string | null {
    if (!html) return null;
    const $ = cheerio.load(html);
    return (
      $("h1.product-title, h1.product_title").first().text().trim() ||
      $('meta[property="og:title"]').attr("content")?.trim() ||
      null
    );
  }

  private stripHtml(s: string): string {
    return s
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private parseMoney(s: string | undefined | null): number | null {
    if (!s) return null;
    const cleaned = String(s).replace(/[^\d]/g, "");
    if (!cleaned) return null;
    const n = Number.parseInt(cleaned, 10);
    return Number.isNaN(n) ? null : n;
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
      "Antec",
      "Cougar",
      "Nzxt",
      "Lian Li",
      "Xtech",
      "Pctronix",
      "Clio",
      "be quiet!",
    ];
    const lowerTitle = title.toLowerCase();
    for (const brand of brands) {
      if (lowerTitle.includes(brand.toLowerCase())) return brand;
    }
    return undefined;
  }

  /**
   * Compatibilidad: extrae URLs desde el HTML de una página de categoría
   * (sólo se invoca si alguien pasa HTML; el flujo principal usa la API).
   */
  async getProductUrls(html: string): Promise<string[]> {
    const $ = cheerio.load(html);
    const urls = new Set<string>();
    $("div.product-small.col a.woocommerce-LoopProduct-link").each((_, a) => {
      const href = $(a).attr("href");
      if (href) urls.add(href);
    });
    return [...urls];
  }
}
