import type { Category, CategoryMap } from "@/constants/categories";
import { BaseCrawler, type ProductData } from "./base";

export const TECTEC_CATEGORIES: CategoryMap<string[]> = {
  gpu: ["componentes-para-pc/tarjetas-de-video"],
  cpu: ["componentes-para-pc/procesadores"],
  psu: ["componentes-para-pc/fuentes-de-poder"],
  motherboard: ["componentes-para-pc/placas-madres"],
  case: ["componentes-para-pc"],
  ram: ["componentes-para-pc/memoria-ram"],
  hdd: ["componentes-para-pc/discos-duro"],
  ssd: ["componentes-para-pc/discos-estado-solido"],
  case_fan: [],
  cpu_cooler: ["componentes-para-pc/refrigeracion-cpu"],
};

export class TectecCrawler extends BaseCrawler<Category> {
  name = "Tectec";
  baseUrl = "https://tectec.cl";

  constructor() {
    super();
    this.useHeadless = true;
  }

  buildCategoryUrl(path: string): string {
    return `${this.baseUrl}/categoria/${path}/`;
  }

  async getAllProductUrlsForCategory(category: Category): Promise<string[]> {
    const paths = TECTEC_CATEGORIES[category] ?? [];
    const allUrls: string[] = [];

    for (const path of paths) {
      const url = this.buildCategoryUrl(path);
      this.logger.info(`[Tectec] Crawling category ${category} -> ${url}`);

      try {
        const urls = await this.getCategoryProductUrls(url);
        allUrls.push(...urls);
      } catch (err) {
        this.logger.error(`[Tectec] Error fetching category ${url}:`, String(err));
      }
    }

    const uniqueUrls = [...new Set(allUrls)];
    this.logger.info(`[Tectec] Found ${uniqueUrls.length} unique product urls for ${category}`);
    return uniqueUrls;
  }

  async getCategoryProductUrls(categoryUrl: string): Promise<string[]> {
    const allUrls: string[] = [];
    const perPage = 100;

    const urlObj = new URL(categoryUrl);
    urlObj.searchParams.set("per_page", String(perPage));

    this.logger.info(`[Tectec] Fetching category page: ${urlObj.toString()}`);
    const firstHtml = await this.fetchHtml(urlObj.toString());

    if (/woocommerce-no-products-found|No se han encontrado productos/i.test(firstHtml)) {
      this.logger.info(`[Tectec] No products found for ${categoryUrl}`);
      return [];
    }

    const firstPageUrls = await this.getProductUrls(firstHtml);
    const validUrls = this.filterValidProductUrls(firstPageUrls);

    if (validUrls.length === 0) {
      this.logger.warn(`[Tectec] No valid product URLs found on first page`);
      return [];
    }

    allUrls.push(...validUrls);

    const totalPages = this.getTotalPages(firstHtml);

    for (let page = 2; page <= totalPages; page++) {
      const pageUrl = `${categoryUrl}page/${page}/?per_page=${perPage}`;
      this.logger.info(`[Tectec] Fetching page ${page}/${totalPages}`);

      const html = await this.fetchHtml(pageUrl);

      if (/woocommerce-no-products-found|No se han encontrado productos/i.test(html)) {
        this.logger.info(`[Tectec] Page ${page} has no products, stopping`);
        break;
      }

      const pageUrls = await this.getProductUrls(html);
      const validPageUrls = this.filterValidProductUrls(pageUrls);

      if (validPageUrls.length === 0) {
        this.logger.warn(`[Tectec] No valid URLs on page ${page}, stopping`);
        break;
      }

      allUrls.push(...validPageUrls);
      await this.waitRateLimit();
    }

    const uniqueUrls = [...new Set(allUrls)];
    this.logger.info(`[Tectec] Extracted ${uniqueUrls.length} valid product URLs`);

    return uniqueUrls;
  }

  private filterValidProductUrls(urls: string[]): string[] {
    return urls.filter((url) => {
      const isProductUrl = url.includes("/producto/");
      const isCategoryUrl = url.includes("/categoria/");

      if (isCategoryUrl || !isProductUrl) {
        this.logger.warn(`[Tectec] Filtered invalid URL: ${url}`);
        return false;
      }

      return true;
    });
  }

  async getProductUrls(html: string): Promise<string[]> {
    const urls: string[] = [];

    const relativeRegex = /href=(?:"|')(?:(https?:\/\/[^"']+)|)(?:\/)?(producto\/[a-zA-Z0-9\-_/]+)(?:"|')/gi;
    for (const match of html.matchAll(relativeRegex)) {
      const [, absolute, relative] = match;
      const url = absolute || `${this.baseUrl}/${relative}`;
      if (url.startsWith("http")) urls.push(url.replace(/&amp;/g, "&"));
    }

    const absoluteRegex = /https?:\/\/tectec\.cl\/producto\/[a-zA-Z0-9\-_/]+/gi;
    const absoluteMatches = html.match(absoluteRegex);
    if (absoluteMatches) urls.push(...absoluteMatches);

    const imageLinkRegex = /<a[^>]*class=["'][^"']*product-image-link[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
    for (const match of html.matchAll(imageLinkRegex)) {
      const href = match[1].replace(/&amp;/g, "&");
      const url = href.startsWith("http") ? href : `${this.baseUrl}${href}`;
      urls.push(url);
    }

    const titleLinkRegex =
      /<h3[^>]*class=["'][^"']*wd-entities-title[^"']*["'][^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
    for (const match of html.matchAll(titleLinkRegex)) {
      const href = match[1].replace(/&amp;/g, "&");
      const url = href.startsWith("http") ? href : `${this.baseUrl}${href}`;
      urls.push(url);
    }

    const cleanedUrls = urls.map((url) => url.split("#")[0]);
    return [...new Set(cleanedUrls)];
  }

  async parseProduct(html: string, url: string): Promise<ProductData | null> {
    const product: ProductData = {
      url,
      title: "",
      price: null,
      originalPrice: null,
      stock: false,
      specs: {},
      mpn: null,
      imageUrl: null,
    };

    product.title = this.extractTitle(html);
    if (!product.title) {
      this.logger.warn(`[Tectec] Missing title for ${url}`);
      return null;
    }

    const prices = this.extractPrices(html, url);
    product.price = prices.current;
    product.originalPrice = prices.original;

    product.imageUrl = this.extractImage(html);
    const stockInfo = this.extractStock(html);
    product.stock = stockInfo.inStock;
    product.stockQuantity = stockInfo.quantity;

    product.mpn = this.extractMpn(html);
    product.specs = this.extractSpecs(html);
    product.context = this.extractContext(html);

    if (!product.price) {
      this.logger.error(`[Tectec] Failed to extract price for ${url}`);
    }

    return product;
  }

  private extractTitle(html: string): string {
    const h1Match = html.match(/<h1[^>]*class=["'][^"']*product_title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1];
    if (h1Match) {
      return h1Match
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1];
    return ogTitle?.trim() ?? "";
  }

  private extractPrices(html: string, url: string): { current: number | null; original: number | null } {
    const jsonLdPrices = this.extractPricesFromJsonLd(html);
    if (jsonLdPrices.current) return jsonLdPrices;

    this.logger.warn(`[Tectec] JSON-LD failed, using HTML fallback for ${url}`);
    return this.extractPricesFromHtml(html);
  }

  private extractPricesFromJsonLd(html: string): { current: number | null; original: number | null } {
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
    if (!jsonLdMatch) return { current: null, original: null };

    try {
      const ld = JSON.parse(jsonLdMatch);
      const items = ld["@graph"] ? ld["@graph"] : Array.isArray(ld) ? ld : [ld];
      const product = items.find((item: any) => item?.["@type"] === "Product");

      if (!product?.offers) return { current: null, original: null };

      const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      if (!offers.priceSpecification) return { current: null, original: null };

      const specs = Array.isArray(offers.priceSpecification) ? offers.priceSpecification : [offers.priceSpecification];

      const prices = specs
        .map((spec: any) => {
          if (!spec?.price) return null;
          const cleaned = typeof spec.price === "string" ? spec.price.replace(/[^\d]/g, "") : String(spec.price);
          return Number(cleaned);
        })
        .filter((price: unknown): price is number => typeof price === "number" && !Number.isNaN(price) && price > 0);

      if (prices.length === 0) return { current: null, original: null };

      return {
        current: Math.min(...prices),
        original: prices.length > 1 ? Math.max(...prices) : null,
      };
    } catch (error) {
      this.logger.error(`[Tectec] JSON-LD parsing error:`, String(error));
      return { current: null, original: null };
    }
  }

  private extractPricesFromHtml(html: string): { current: number | null; original: number | null } {
    const priceBlock = html.match(/<p[^>]*class=["'][^"']*price["'][^>]*>([\s\S]*?)<\/p>/i)?.[1];
    if (!priceBlock) return { current: null, original: null };

    const priceRegex =
      /<span[^>]*class=["'][^"']*woocommerce-Price-amount[^"']*["'][^>]*>[\s\S]*?<bdi>[\s\S]*?\$\s*([0-9.,]+)[\s\S]*?<\/bdi>[\s\S]*?<\/span>/gi;
    const prices: number[] = [];

    for (const match of priceBlock.matchAll(priceRegex)) {
      const priceStr = match[1].replace(/[.,]/g, "");
      const priceVal = Number(priceStr);
      if (!Number.isNaN(priceVal) && priceVal > 0) {
        prices.push(priceVal);
      }
    }

    if (prices.length === 0) return { current: null, original: null };

    return {
      current: Math.min(...prices),
      original: prices.length > 1 ? Math.max(...prices) : null,
    };
  }

  private extractImage(html: string): string | null {
    return html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1] ?? null;
  }

  private extractStock(html: string): { inStock: boolean; quantity: number | null } {
    const inStockMatch = html.match(
      /<p[^>]*class=["'][^"']*stock[^"']*in-stock[^"']*["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i,
    )?.[1];

    if (inStockMatch) {
      const quantityMatch = inStockMatch.match(/(\d+)/);
      if (quantityMatch) {
        const quantity = Number.parseInt(quantityMatch[1], 10);
        return { inStock: quantity > 0, quantity };
      }
      if (/disponible|disponibles/i.test(inStockMatch)) {
        return { inStock: true, quantity: 1 };
      }
    }

    const outOfStock =
      /<p[^>]*class=["'][^"']*stock[^"']*out-of-stock[^"']*["'][^>]*>/i.test(html) || /Sin existencias/i.test(html);

    return { inStock: !outOfStock, quantity: outOfStock ? 0 : null };
  }

  private extractMpn(html: string): string | null {
    const partNumber = html.match(/<td[^>]*>\s*Part\s*Number\s*<\/td>\s*<td[^>]*>\s*([^<]+?)\s*<\/td>/i)?.[1];
    const model = html.match(/<td[^>]*>\s*Model\s*<\/td>\s*<td[^>]*>\s*([^<]+?)\s*<\/td>/i)?.[1];
    return partNumber?.trim() ?? model?.trim() ?? null;
  }

  private extractSpecs(html: string): Record<string, string> {
    const specs: Record<string, string> = {};
    const descBlock = html.match(
      /<div[^>]*class=["'][^"']*woocommerce-Tabs-panel[^"']*tab-description[^"']*["'][\s\S]*?<\/div>/i,
    )?.[0];

    const targetHtml = descBlock ?? html;
    const forbiddenTerms = [
      "transferencia",
      "tarjeta",
      "tarjetas",
      "pago",
      "precio",
      "cuota",
      "cuotas",
      "subtotal",
      "total",
      "envio",
      "envío",
      "forma de pago",
    ];

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    for (const trMatch of targetHtml.matchAll(trRegex)) {
      const trHtml = trMatch[1];

      if (
        /(<form|<button|<input|add to cart|payment|tarjeta|transferencia|cuota|cuotas|pago|subtotal|total)/i.test(
          trHtml,
        )
      ) {
        continue;
      }

      const cellRegex = /<(td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
      const cells = Array.from(trHtml.matchAll(cellRegex)).map((match) =>
        match[2]
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&times;/g, "×")
          .replace(/\s+/g, " ")
          .trim(),
      );

      if (cells.length < 2) continue;

      const key = cells[0];
      const value = cells[cells.length - 1];

      const isForbidden = forbiddenTerms.some(
        (term) => key.toLowerCase().includes(term) || value.toLowerCase().includes(term),
      );

      if (!isForbidden && key && value && !specs[key]) {
        specs[key] = value;
      }
    }

    const dtRegex = /<dt[^>]*>\s*([^<]+?)\s*<\/dt>\s*<dd[^>]*>\s*([\s\S]*?)\s*<\/dd>/gi;
    for (const match of html.matchAll(dtRegex)) {
      const key = match[1]?.trim();
      const value = match[2]?.replace(/<[^>]+>/g, "").trim();
      if (key && value && !specs[key]) {
        specs[key] = value;
      }
    }

    return specs;
  }

  private extractContext(html: string): { description_html: string; description_text: string } | undefined {
    const descBlock = html.match(
      /<div[^>]*class=["'][^"']*woocommerce-Tabs-panel[^"']*tab-description[^"']*["'][\s\S]*?<\/div>/i,
    )?.[0];

    if (!descBlock) return undefined;

    const text = descBlock
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      description_html: descBlock.trim(),
      description_text: text,
    };
  }

  private getTotalPages(html: string): number {
    const pagesMatch = html.match(/(\d+)\s+páginas?/i)?.[1];
    if (pagesMatch) return Number(pagesMatch);

    const liRegex = /<li[^>]*class=["'][^"']*page-item[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
    const numberRegex = /(?:<a[^>]*>(\d+)<\/a>|<span[^>]*>(\d+)<\/span>)/i;
    const pages: number[] = [];

    for (const match of html.matchAll(liRegex)) {
      const content = match[1];
      const numMatch = content.match(numberRegex);
      const num = numMatch ? Number(numMatch[1] ?? numMatch[2]) : NaN;
      if (!Number.isNaN(num)) pages.push(num);
    }

    if (pages.length > 0) return Math.max(...pages);

    const pagesUl = html.match(/<ul[^>]*class=["'][^"']*page-numbers[^"']*["'][\s\S]*?<\/ul>/i)?.[0];
    if (pagesUl) {
      const numRegex = /<a[^>]*>(\d+)<\/a>|<span[^>]*>(\d+)<\/span>/gi;
      const found: number[] = [];

      for (const match of pagesUl.matchAll(numRegex)) {
        const n = Number(match[1] ?? match[2]);
        if (!Number.isNaN(n)) found.push(n);
      }

      if (found.length > 0) return Math.max(...found);
    }

    return 1;
  }
}
