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

  buildCategoryUrl(path: string): string {
    // path example: componentes-para-pc/discos-estado-solido
    return `${this.baseUrl}/categoria/${path}/`;
  }

  async getAllProductUrlsForCategory(category: Category): Promise<string[]> {
    const paths = TECTEC_CATEGORIES[category] || [];
    const all: string[] = [];

    for (const p of paths) {
      const url = this.buildCategoryUrl(p);
      this.logger.info(`[Tectec] Crawling category ${category} -> ${url}`);
      try {
        const urls = await this.getCategoryProductUrls(url);
        all.push(...urls);
      } catch (err) {
        this.logger.error(`[Tectec] Error fetching category ${url}:`, String(err));
      }
    }

    const unique = [...new Set(all)];
    this.logger.info(`[Tectec] Found ${unique.length} unique product urls for ${category}`);
    return unique;
  }

  async getCategoryProductUrls(categoryUrl: string): Promise<string[]> {
    const all: string[] = [];

    const perPage = 100; // prefer a high per_page to reduce pagination where supported

    this.logger.info(`[Tectec] Fetching category page (per_page=${perPage}): ${categoryUrl}`);
    // ensure per_page param is included on the first request
    const urlObj = new URL(categoryUrl);
    urlObj.searchParams.set("per_page", String(perPage));
    const firstUrl = urlObj.toString();

    const firstHtml = await this.fetchHtml(firstUrl);

    // Early exit: no products found notice
    if (/woocommerce-no-products-found|No se han encontrado productos/i.test(firstHtml)) {
      this.logger.info(`[Tectec] No products found for ${categoryUrl}`);
      return [];
    }

    all.push(...(await this.getProductUrls(firstHtml)));

    const totalPages = this.getTotalPages(firstHtml);
    for (let page = 2; page <= totalPages; page++) {
      // Build page URL using /page/X/ followed by ?per_page=...
      const pageUrl = `${categoryUrl}page/${page}/?per_page=${perPage}`;
      this.logger.info(`[Tectec] Fetching category page ${page}/${totalPages}: ${pageUrl}`);
      const html = await this.fetchHtml(pageUrl);

      // If this page reports "no products" stop early
      if (/woocommerce-no-products-found|No se han encontrado productos/i.test(html)) {
        this.logger.info(`[Tectec] Page ${page} reports no products; stopping pagination`);
        break;
      }

      const urls = await this.getProductUrls(html);
      if (urls.length === 0) {
        this.logger.warn(`[Tectec] No product urls found on page ${page}; stopping early.`);
        break;
      }
      all.push(...urls);
      await this.waitRateLimit();
    }

    return [...new Set(all)];
  }

  async getProductUrls(html: string): Promise<string[]> {
    const urls: string[] = [];

    // Captura enlaces absolutos o relativos que apunten a /producto/
    const regex = /href=(?:"|')(?:(https?:\/\/[^"']+)|)(?:\/)?(producto\/[a-zA-Z0-9\-_/]+)(?:"|')/gi;
    let m: RegExpExecArray | null = null;
    for (;;) {
      m = regex.exec(html);
      if (m === null) break;
      const abs = m[1];
      const rel = m[2];
      let link = "";
      if (abs) link = abs;
      else link = `${this.baseUrl}/${rel}`;
      // Normalize ampersands
      link = link.replace(/&amp;/g, "&");
      if (link.startsWith("http")) urls.push(link);
    }

    // Fallback: find absolute product urls directly
    const absRegex = /https?:\/\/tectec\.cl\/producto\/[a-zA-Z0-9\-_/]+/gi;
    const matches = html.match(absRegex);
    if (matches) urls.push(...matches);

    // Additional grid selectors fallback: product-image-link and wd-entities-title anchors
    const imgLinkRe = /<a[^>]*class=["'][^"']*product-image-link[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
    let im: RegExpExecArray | null = null;
    for (;;) {
      im = imgLinkRe.exec(html);
      if (!im) break;
      const href = im[1].replace(/&amp;/g, "&");
      const absolute = href.startsWith("http") ? href : `${this.baseUrl}${href}`;
      urls.push(absolute);
    }

    const titleLinkRe =
      /<h3[^>]*class=["'][^"']*wd-entities-title[^"']*["'][^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
    let tm: RegExpExecArray | null = null;
    for (;;) {
      tm = titleLinkRe.exec(html);
      if (!tm) break;
      const href = tm[1].replace(/&amp;/g, "&");
      const absolute = href.startsWith("http") ? href : `${this.baseUrl}${href}`;
      urls.push(absolute);
    }

    // Normalize and dedupe
    const cleaned = urls.map((u) => u.split("#")[0]);
    return [...new Set(cleaned)];
  }

  async parseProduct(html: string, url: string): Promise<ProductData | null> {
    const prod: ProductData = {
      url,
      title: "",
      price: null,
      originalPrice: null,
      stock: false,
      specs: {},
      mpn: null,
      imageUrl: null,
    };

    // Title: prefer h1 with class product_title (fallback to og:title)
    const h1Match = html.match(/<h1[^>]*class=["'][^"']*product_title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1];
    if (h1Match) {
      prod.title = h1Match
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    if (!prod.title) {
      const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1];
      if (ogTitle) prod.title = ogTitle.trim();
    }

    // Prices: parse prices inside the cart form table; take min as `price` (transferencia) and max as `originalPrice` if present
    const formMatch = html.match(/<form[^>]*class=["'][^"']*cart[^"']*["'][\s\S]*?<\/form>/i)?.[0];
    if (formMatch) {
      const priceRe = /\$\s*([0-9.,]+)/g;
      const nums: number[] = [];
      let pm: RegExpExecArray | null = null;
      for (;;) {
        pm = priceRe.exec(formMatch);
        if (!pm) break;
        const cleaned = String(pm[1]).replace(/[.,]/g, "");
        const val = Number.parseInt(cleaned.replace(/[^0-9]/g, ""), 10);
        if (!Number.isNaN(val)) nums.push(val);
      }
      if (nums.length > 0) {
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        prod.price = min;
        prod.originalPrice = max !== min ? max : null;
      }
    }

    // Fallback: try JSON-LD offers or text matches for price if not found above
    if (
      (prod.price === null || prod.price === undefined) &&
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>/i.test(html)
    ) {
      const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
      if (jsonLdMatch) {
        try {
          const ld = JSON.parse(jsonLdMatch);
          const productLd = Array.isArray(ld)
            ? ld.find(
                (p: unknown) =>
                  typeof p === "object" && p !== null && (p as Record<string, unknown>)["@type"] === "Product",
              ) || ld[0]
            : ld;
          const offers = (productLd as unknown as { offers?: unknown })?.offers;
          if (offers) {
            let priceVal: unknown;
            if (Array.isArray(offers)) {
              priceVal = offers.length > 0 ? (offers[0] as Record<string, unknown>).price : undefined;
            } else if (typeof offers === "object" && offers !== null) {
              priceVal = (offers as Record<string, unknown>).price;
            }
            if (priceVal && (prod.price === null || prod.price === undefined)) {
              prod.price = Number.parseInt(String(priceVal).replace(/[^0-9]/g, ""), 10) || null;
            }
          }
        } catch (_e) {
          // ignore malformed JSON-LD
        }
      }
    }

    // Image: prefer og:image
    const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1];
    if (ogImage) prod.imageUrl = ogImage;

    // Stock: look for in-stock/out-of-stock with quantity
    const inStockMatch = html.match(
      /<p[^>]*class=["'][^"']*stock[^"']*in-stock[^"']*["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i,
    )?.[1];
    if (inStockMatch) {
      const qMatch = inStockMatch.match(/(\d+)/);
      if (qMatch?.[1]) {
        const q = Number.parseInt(qMatch[1], 10);
        prod.stockQuantity = q;
        prod.stock = q > 0;
      } else if (/disponible|disponibles/i.test(inStockMatch)) {
        prod.stock = true;
      }
    } else if (
      /<p[^>]*class=["'][^"']*stock[^"']*out-of-stock[^"']*["'][^>]*>/i.test(html) ||
      /Sin existencias/i.test(html)
    ) {
      prod.stock = false;
      prod.stockQuantity = 0;
    }

    // MPN: look for Part Number, fallback to Model inside the description/spec table
    const partNumberMatch = html.match(/<td[^>]*>\s*Part\s*Number\s*<\/td>\s*<td[^>]*>\s*([^<]+?)\s*<\/td>/i)?.[1];
    const modelMatch = html.match(/<td[^>]*>\s*Model\s*<\/td>\s*<td[^>]*>\s*([^<]+?)\s*<\/td>/i)?.[1];
    if (partNumberMatch) prod.mpn = partNumberMatch.trim();
    else if (modelMatch) prod.mpn = modelMatch.trim();

    // Specs: parse the description panel table (robust handling for various table shapes)
    const specs: Record<string, string> = {};
    // Try to find the description block which contains the specs table
    const descBlockMatch = html.match(
      /<div[^>]*class=["'][^"']*woocommerce-Tabs-panel[^"']*tab-description[^"']*["'][\s\S]*?<\/div>/i,
    )?.[0];

    const targetHtmlForSpecs = descBlockMatch || html;

    // Iterate each <tr> and extract cells more reliably
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trm: RegExpExecArray | null = null;
    for (;;) {
      trm = trRegex.exec(targetHtmlForSpecs);
      if (!trm) break;
      const trHtml = trm[1];

      // Skip rows that clearly belong to payments/cart/controls
      if (
        /(<form|<button|<input|add to cart|payment|tarjeta|transferencia|cuota|cuotas|pago|subtotal|total)/i.test(
          trHtml,
        )
      )
        continue;

      // Extract all td/th cell HTMLs
      const cellRe = /<(td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
      const cells: string[] = [];
      let cm: RegExpExecArray | null = null;
      for (;;) {
        cm = cellRe.exec(trHtml);
        if (!cm) break;
        // Clean inner HTML -> plain text
        const text = cm[2]
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&times;/g, "×")
          .replace(/\s+/g, " ")
          .trim();
        cells.push(text);
      }

      if (cells.length < 2) continue;

      // Prefer first cell as key and last cell as value (handles rows with >2 columns)
      const k = cells[0];
      const v = cells[cells.length - 1];

      // Skip obvious non-spec rows
      const forbidden = [
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
      const fk = k.toLowerCase();
      const fv = v.toLowerCase();
      if (forbidden.some((f) => fk.includes(f) || fv.includes(f))) continue;

      if (k && v && !specs[k]) specs[k] = v;
    }
    // dt/dd fallback
    const dtRegex = /<dt[^>]*>\s*([^<]+?)\s*<\/dt>\s*<dd[^>]*>\s*([\s\S]*?)\s*<\/dd>/gi;
    let dm: RegExpExecArray | null = null;
    for (;;) {
      dm = dtRegex.exec(html);
      if (!dm) break;
      const k = dm[1]?.trim();
      const v = dm[2]?.replace(/<[^>]+>/g, "").trim();
      if (k && v && !specs[k]) specs[k] = v;
    }
    if (Object.keys(specs).length > 0) prod.specs = specs;

    // Context: include the description HTML and cleaned text for downstream IA
    if (descBlockMatch) {
      const htmlSnippet = descBlockMatch;
      const text = htmlSnippet
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      prod.context = { description_html: htmlSnippet.trim(), description_text: text };
    }

    // Basic validation
    if (!prod.title) {
      this.logger.warn(`[Tectec] Missing title for ${url}`);
      return null;
    }

    return prod;
  }

  private getTotalPages(html: string): number {
    const pagesMatch = html.match(/(\d+)\s+páginas?/i)?.[1];
    if (pagesMatch) return Number(pagesMatch);

    // Pagination links
    const liRegex = /<li[^>]*class=["'][^"']*page-item[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
    const numberRegex = /(?:<a[^>]*>(\d+)<\/a>|<span[^>]*>(\d+)<\/span>)/i;
    const pages: number[] = [];
    let m: RegExpExecArray | null = null;
    for (;;) {
      m = liRegex.exec(html);
      if (m === null) break;
      const content = m[1];
      const nm = content.match(numberRegex);
      const num = nm ? Number(nm[1] || nm[2]) : NaN;
      if (num && !Number.isNaN(num)) pages.push(num);
    }
    if (pages.length > 0) return Math.max(...pages);

    // Try the theme's ul.page-numbers pagination if present
    const pagesUlMatch = html.match(/<ul[^>]*class=["'][^"']*page-numbers[^"']*["'][\s\S]*?<\/ul>/i)?.[0];
    if (pagesUlMatch) {
      const numRe = /<a[^>]*>(\d+)<\/a>|<span[^>]*>(\d+)<\/span>/gi;
      const found: number[] = [];
      let nm: RegExpExecArray | null = null;
      for (;;) {
        nm = numRe.exec(pagesUlMatch);
        if (!nm) break;
        const n = Number(nm[1] || nm[2]);
        if (n && !Number.isNaN(n)) found.push(n);
      }
      if (found.length > 0) return Math.max(...found);
    }

    return 1;
  }
}
