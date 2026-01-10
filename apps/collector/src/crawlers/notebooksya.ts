import * as cheerio from "cheerio";
import type { Category, CategoryMap } from "@/constants/categories";
import { BaseCrawler, type ProductData } from "./base";

export const NOTEBOOKSYA_CATEGORIES: CategoryMap<string[]> = {
  ssd: [
    "https://notebooksya.cl/product-category/almacenamiento-ya/?filter_producto-almacenamiento=unidad-de-estado-solido",
  ],
  hdd: ["https://notebooksya.cl/product-category/almacenamiento-ya/?filter_producto-almacenamiento=disco-duro-interno"],
  psu: ["https://notebooksya.cl/product-category/partes-y-piezas-ya/?filter_producto-partes-y-piezas=fuente-de-poder"],
  ram: [
    "https://notebooksya.cl/product-category/partes-y-piezas-ya/?filter_producto-partes-y-piezas=memoria-ram-para-pc",
  ],
  motherboard: [
    "https://notebooksya.cl/product-category/partes-y-piezas-ya/?filter_producto-partes-y-piezas=placa-madre",
  ],
  cpu: ["https://notebooksya.cl/product-category/partes-y-piezas-ya/?filter_producto-partes-y-piezas=procesadores"],
  gpu: ["https://notebooksya.cl/product-category/partes-y-piezas-ya/?filter_producto-partes-y-piezas=tarjeta-de-video"],
  case: ["https://notebooksya.cl/product-category/partes-y-piezas-ya/?filter_producto-partes-y-piezas=gabinetes"],
  // Not available in this store
  cpu_cooler: [],
  case_fan: [],
};

export class NotebooksYaCrawler extends BaseCrawler<Category> {
  name = "NotebooksYa";
  baseUrl = "https://notebooksya.cl";

  protected useHeadless = true;

  async getAllProductUrlsForCategory(category: Category): Promise<string[]> {
    const urls: string[] = [];
    const categoryUrls = NOTEBOOKSYA_CATEGORIES[category];

    if (!categoryUrls || categoryUrls.length === 0) {
      this.logger.warn(`No URLs configured for category: ${category}`);
      return [];
    }

    for (const startUrl of categoryUrls) {
      let page = 1;
      let hasNextPage = true;

      this.logger.info(`Crawling category ${category} from ${startUrl}`);

      while (hasNextPage) {
        // Build the paginated URL
        let pageUrl: string;
        if (page === 1) {
          pageUrl = startUrl;
        } else {
          // Pagination pattern: insert /page/N/ before query params
          const urlObj = new URL(startUrl);
          const basePath = urlObj.pathname.replace(/\/$/, "");
          urlObj.pathname = `${basePath}/page/${page}/`;
          pageUrl = urlObj.toString();
        }

        try {
          this.logger.info(`Fetching page ${page}: ${pageUrl}`);
          const html = await this.fetchHtml(pageUrl, "ul.products");

          // Check for 404 page
          if (
            html.includes("That page can't be found") ||
            html.includes("page-title") ||
            html.includes("error-404") ||
            !html.includes("products")
          ) {
            this.logger.info(`Page ${page} not found or content end. Stopping.`);
            hasNextPage = false;
            break;
          }

          const pageUrls = this.extractUrlsFromList(html, category);

          if (pageUrls.length === 0) {
            this.logger.info(`No products found on page ${page}. Stopping.`);
            hasNextPage = false;
            break;
          }

          urls.push(...pageUrls);
          page++;

          await this.waitRateLimit();
        } catch (error) {
          const errString = String(error);
          if (errString.includes("404")) {
            this.logger.info(`Page ${page} returned 404. Stopping category.`);
          } else {
            this.logger.error(`Error fetching page ${page} of ${category}:`, errString);
          }
          hasNextPage = false;
        }
      }
    }

    // Deduplicate
    return [...new Set(urls)];
  }

  private extractUrlsFromList(html: string, _category: Category): string[] {
    const $ = cheerio.load(html);
    const urls: string[] = [];

    $("ul.products li.product").each((_, el) => {
      const link = $(el).find("a.woocommerce-LoopProduct-link").attr("href");
      if (link) {
        urls.push(link);
      }
    });

    return urls;
  }

  async parseProduct(html: string, url: string): Promise<ProductData | null> {
    const $ = cheerio.load(html);

    // Title
    const title = $("h1.product_title.entry-title").text().trim();
    if (!title) {
      this.logger.warn(`Missing title for ${url}`);
      return null;
    }

    // Prices
    // Cash price (inside <ins>)
    let price: number | null = null;
    const cashPriceText = $("ins .woocommerce-Price-amount bdi").first().text().replace(/[^\d]/g, "");
    if (cashPriceText) {
      price = Number.parseInt(cashPriceText, 10);
    }

    // Normal price (outside ins, in wds-price or from wds-second)
    let originalPrice: number | null = null;
    const normalPriceText = $("p.wds-price .woocommerce-Price-amount bdi").text().replace(/[^\d]/g, "");
    if (normalPriceText) {
      originalPrice = Number.parseInt(normalPriceText, 10);
    }

    // Fallback: look for wds-second for webpay price
    if (!originalPrice) {
      const webpayPriceText = $(".wds-second .wds-price .woocommerce-Price-amount bdi").text().replace(/[^\d]/g, "");
      if (webpayPriceText) {
        originalPrice = Number.parseInt(webpayPriceText, 10);
      }
    }

    // If no cash price found, try from wds-first (transferencia)
    if (!price) {
      const transferPriceText = $(".wds-first .wds-price .woocommerce-Price-amount bdi").text().replace(/[^\d]/g, "");
      if (transferPriceText) {
        price = Number.parseInt(transferPriceText, 10);
      }
    }

    // Ensure price/originalPrice are properly ordered
    if (!originalPrice && price) originalPrice = price;
    if (price && originalPrice && price > originalPrice) {
      const temp = price;
      price = originalPrice;
      originalPrice = temp;
    }

    // Stock
    let stock = false;
    let stockQuantity: number | null = null;

    const stockElement = $("p.stock.in-stock");
    if (stockElement.length > 0) {
      stock = true;
      const stockText = stockElement.text();
      const match = stockText.match(/(\d+)/);
      if (match) {
        stockQuantity = Number.parseInt(match[1], 10);
      }
    }

    const outOfStock = $("p.stock.out-of-stock");
    if (outOfStock.length > 0) {
      stock = false;
      stockQuantity = 0;
    }

    // Image
    const imageUrl =
      $("img.wp-post-image").attr("src") ||
      $('meta[property="og:image"]').attr("content") ||
      $(".woocommerce-product-gallery__image img").attr("src");

    // MPN / SKU
    const mpn = $("span.sku").text().trim() || null;

    // Description / context
    const descriptionText = $("#tab-description").text().trim();
    const descriptionHtml = $("#tab-description").html() || "";

    // Extract manufacturer from title
    const manufacturer = this.extractManufacturer(title, mpn || "");

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
      imageUrl: imageUrl || null,
      specs,
      context: {
        description_text: descriptionText,
        description_html: descriptionHtml,
      },
    };
  }

  private extractManufacturer(title: string, _sku: string): string | undefined {
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

  async getProductUrls(html: string): Promise<string[]> {
    return this.extractUrlsFromList(html, "gpu");
  }
}
