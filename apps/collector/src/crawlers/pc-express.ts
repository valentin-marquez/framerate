import * as cheerio from "cheerio";
import type { Category, CategoryMap } from "@/constants/categories";
import { BaseCrawler, type ProductData } from "./base";

export const PC_EXPRESS_CATEGORIES: CategoryMap<string[]> = {
  gpu: ["475"],
  cpu: ["337", "367", "591", "309", "348", "380", "583", "588", "600"],
  psu: ["460_461"],
  motherboard: ["460_472"],
  case: ["120"],
  ram: ["126"],
  hdd: ["62_413_101"],
  ssd: ["62_331"],
  case_fan: ["170"],
  cpu_cooler: ["169"],
};

export class PcExpressCrawler extends BaseCrawler<Category> {
  name = "PC-Express";
  baseUrl = "https://tienda.pc-express.cl";

  buildCategoryUrl(pathId: string): string {
    return `${this.baseUrl}/index.php?route=product/category&path=${pathId}`;
  }

  async getAllProductUrlsForCategory(category: Category): Promise<string[]> {
    const pathIds = PC_EXPRESS_CATEGORIES[category];
    const allUrls: string[] = [];

    this.logger.info(`Scraping category "${category}" with ${pathIds.length} subcategories`);

    for (const pathId of pathIds) {
      const categoryUrl = this.buildCategoryUrl(pathId);
      this.logger.info(`Scraping subcategory path=${pathId}`);

      const urls = await this.getCategoryProductUrls(categoryUrl);
      allUrls.push(...urls);
    }

    const uniqueUrls = [...new Set(allUrls)];
    this.logger.info(`Total unique product URLs for "${category}": ${uniqueUrls.length}`);

    return uniqueUrls;
  }

  /** Obtiene URLs de productos con paginación automática */
  async getCategoryProductUrls(categoryUrl: string): Promise<string[]> {
    const allUrls: string[] = [];
    const limit = 100;

    const urlWithLimit = this.addLimitToUrl(categoryUrl, limit);

    this.logger.info(`Starting scraping of category: ${urlWithLimit}`);

    const firstPageHtml = await this.fetchHtml(urlWithLimit);
    const firstPageUrls = await this.getProductUrls(firstPageHtml);
    allUrls.push(...firstPageUrls);

    const totalPages = this.getTotalPages(firstPageHtml);
    this.logger.info(`Total pages found: ${totalPages}`);

    for (let page = 2; page <= totalPages; page++) {
      const pageUrl = `${urlWithLimit}&page=${page}`;
      this.logger.info(`Fetching page ${page}/${totalPages}: ${pageUrl}`);

      const pageHtml = await this.fetchHtml(pageUrl);
      const pageUrls = await this.getProductUrls(pageHtml);

      this.logger.info(`Found ${pageUrls.length} product URLs on page ${page}`);
      if (pageUrls.length === 0) {
        this.logger.warn(`No product URLs found on page ${page}, stopping pagination early.`);
        break;
      }

      allUrls.push(...pageUrls);
    }

    this.logger.info(`Total product URLs found: ${allUrls.length}`);
    return allUrls;
  }

  async getProductUrls(html: string): Promise<string[]> {
    const urls: string[] = [];
    const rewriter = new HTMLRewriter();

    rewriter.on(".product-list__item .product-list__image a", {
      element: (element) => {
        const link = element.getAttribute("href");

        if (link) {
          const decodedHref = link.replace(/&amp;/g, "&");
          const absoluteUrl = decodedHref.startsWith("http") ? decodedHref : `${this.baseUrl}${decodedHref}`;

          urls.push(absoluteUrl);
        }
      },
    });

    // Backup: some versions put the product link on the name
    rewriter.on(".product-list__name a", {
      element: (element) => {
        const link = element.getAttribute("href");
        if (link) {
          const decodedHref = link.replace(/&amp;/g, "&");
          const absoluteUrl = decodedHref.startsWith("http") ? decodedHref : `${this.baseUrl}${decodedHref}`;
          urls.push(absoluteUrl);
        }
      },
    });

    rewriter.transform(html);

    return urls;
  }

  async parseProduct(html: string, url: string): Promise<ProductData | null> {
    const $ = cheerio.load(html);
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

    // Título
    product.title = $("h1.rm-product-page__title").first().text().trim();

    // Marca
    let brandRaw = $(".rm-product__brand span a").text().trim();
    if (!brandRaw) {
      // Fallback
      const brandLink = $('p:contains("Marca")').find("a");
      if (brandLink.length > 0) brandRaw = brandLink.text().trim();
      else {
        const brandText = $('p:contains("Marca")').text();
        const match = brandText.match(/Marca\s*:\s*(.+)/i);
        if (match) brandRaw = match[1].trim();
      }
    }

    // MPN
    let mpnRaw = $(".rm-product__mpn").text().trim();
    if (!mpnRaw) {
      const mpnText = $('p:contains("MPN")').text();
      const match = mpnText.match(/MPN\s*:\s*(.+)/i);
      if (match) mpnRaw = match[1].trim();
    }
    product.mpn = mpnRaw.replace(/Manufacturer Part Number:|MPN:/i, "").trim() || null;

    // Precios
    const priceCashStr = $(".rm-product__price--cash h3").text().trim();
    const priceNormalStr = $(".rm-product__price--normal h3").text().trim();

    let cash = this.parsePrice(priceCashStr);
    let normal = this.parsePrice(priceNormalStr);

    // Fallback prices
    if (cash === null || normal === null) {
      $(".rm-product-page__price").each((_, el) => {
        const h3 = $(el).find("h3");
        const price = this.parsePrice(h3.text());
        if (h3.hasClass("text-primary")) {
          if (cash === null) cash = price;
        } else {
          if (normal === null) normal = price;
        }
      });
    }

    // JSON-LD Fallback
    if (cash === null || normal === null) {
      const script = $('script[type="application/ld+json"]').html();
      if (script) {
        try {
          const json = JSON.parse(script);
          // biome-ignore lint/suspicious/noExplicitAny: JSON-LD
          const p = Array.isArray(json) ? json.find((x: any) => x["@type"] === "Product") : json;
          if (p && p.offers) {
            const price = p.offers.price || (p.offers[0] && p.offers[0].price);
            if (price && cash === null) cash = Number(price);
            if (p.sku && !product.mpn) product.mpn = p.sku;
          }
        } catch (_e) {
          // ignore
        }
      }
    }

    // Fallback: Generate MPN from URL if still null
    if (!product.mpn) {
      try {
        const urlObj = new URL(url);
        const productId = urlObj.searchParams.get("product_id");
        if (productId) {
          product.mpn = `PCX-${productId}`;
        } else {
          // Try to extract from path if it's a SEO URL
          const match = url.match(/\/([^/]+)$/);
          if (match?.[1]) {
            // Remove query params if any
            const slug = match[1].split("?")[0];
            if (slug) {
              product.mpn = `PCX-${slug.toUpperCase()}`;
            }
          }
        }
      } catch (_e) {
        // ignore URL parsing errors
      }
    }

    product.price = cash;
    product.originalPrice = normal ?? cash;

    // Stock
    let stockCount = 0;
    $('span[id^="stock-sucursal-"]').each((_, el) => {
      const text = $(el).text().trim();
      const match = text.match(/\+?(\d+)/);
      if (match) stockCount += Number(match[1]);
    });

    const hasAddToCart = $("#button-cart, .add-to-cart-btn").length > 0;
    product.stock = stockCount > 0 || hasAddToCart;
    product.stockQuantity = stockCount > 0 ? stockCount : null;

    // Imagen
    product.imageUrl =
      $(".thumbnails img").first().attr("src") || $('meta[property="og:image"]').attr("content") || null;

    // Specs
    if (brandRaw) {
      product.specs = { manufacturer: brandRaw };
    }

    const techSpecs = this.extractTechnicalSpecs($);
    product.specs = { ...product.specs, ...techSpecs };

    // Context
    let descBlock = $(".product-description__content");
    if (descBlock.length === 0) {
      descBlock = $("#product-description");
    }

    if (descBlock.length > 0) {
      product.context = {
        description_html: descBlock.html() || "",
        description_text: descBlock.text().replace(/\s+/g, " ").trim(),
      };
    }

    // Clean title
    product.title = product.title.replace(/P\/N.*$/i, "").trim();

    if (!product.title || !product.imageUrl) {
      this.logger.warn(`Failed to parse product: ${url} missing title or image`);
      return null;
    }

    return product;
  }

  private extractTechnicalSpecs($: cheerio.CheerioAPI): Record<string, string> {
    const specs: Record<string, string> = {};

    // 1. Table rows
    $("tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        const key = $(tds[0]).text().trim();
        const value = $(tds[1]).text().trim();
        if (key && value) specs[key] = value;
      }
    });

    // 2. dt/dd
    $("dt").each((_, dt) => {
      const key = $(dt).text().trim();
      const value = $(dt).next("dd").text().trim();
      if (key && value) specs[key] = value;
    });

    return specs;
  }

  private parsePrice(priceStr: string): number | null {
    if (!priceStr) return null;
    const clean = String(priceStr).replace(/[^\d]/g, "");
    if (!clean) return null;
    return Number.parseInt(clean, 10);
  }

  private addLimitToUrl(url: string, limit: number): string {
    const urlObj = new URL(url);
    urlObj.searchParams.set("limit", String(limit));
    return urlObj.toString();
  }

  private getTotalPages(html: string): number {
    // 1) Try summary text like "Mostrando del 1 al 20 de 38 (2 páginas)"
    const summaryMatch = html.match(/\((\d+)\s+páginas?\)/i);
    if (summaryMatch?.[1]) {
      const pages = Number.parseInt(summaryMatch[1], 10);
      this.logger.info(`getTotalPages: detected ${pages} pages via summary text`);
      return pages;
    }

    // 2) Parse the pagination list and look for numeric page items
    const liRegex = /<li[^>]*class=["'][^"']*page-item[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
    const numberRegex = /(?:<a[^>]*>(\d+)<\/a>|<span[^>]*>(\d+)<\/span>)/i;
    const pages: number[] = [];
    let liMatch: RegExpExecArray | null = null;
    for (;;) {
      liMatch = liRegex.exec(html);
      if (liMatch === null) break;
      const liContent = liMatch[1];
      const numMatch = liContent.match(numberRegex);
      const num = numMatch ? Number(numMatch[1] || numMatch[2]) : NaN;
      if (num && !Number.isNaN(num)) pages.push(num);
    }
    if (pages.length > 0) {
      const maxPage = Math.max(...pages);
      this.logger.info(`getTotalPages: detected ${maxPage} pages via pagination list`);
      return maxPage;
    }

    // 3) Fallback to 1
    this.logger.info("getTotalPages: pagination not found, defaulting to 1");
    return 1;
  }
}
