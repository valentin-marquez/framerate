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
        let pageUrl: string;
        if (page === 1) {
          pageUrl = startUrl;
        } else {
          const urlObj = new URL(startUrl);
          const basePath = urlObj.pathname.replace(/\/$/, "");
          urlObj.pathname = `${basePath}/page/${page}/`;
          pageUrl = urlObj.toString();
        }

        try {
          this.logger.info(`Fetching page ${page}: ${pageUrl}`);
          const html = await this.fetchHtml(pageUrl, "ul.products");

          if (
            html.includes("That page can't be found") ||
            html.includes("error-404 not-found") ||
            html.includes("Error 404")
          ) {
            this.logger.info(`Page ${page} not found. Stopping.`);
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

    const title = $("h1.product_title.entry-title").text().trim();
    if (!title) {
      this.logger.warn(`Missing title for ${url}`);
      return null;
    }

    // --- NUEVA LÓGICA DE EXTRACCIÓN DE PRECIOS ---
    let price: number | null = null; // Efectivo / Transferencia
    let originalPrice: number | null = null; // Normal / Webpay

    // 1. Intentar capturar precio de transferencia (wds-first)
    const transferText = $(".wds-first .woocommerce-Price-amount").first().text().replace(/[^\d]/g, "");
    if (transferText) {
      price = Number.parseInt(transferText, 10);
    }

    // 2. Intentar capturar precio Webpay (wds-second)
    const webpayText = $(".wds-second .woocommerce-Price-amount").first().text().replace(/[^\d]/g, "");
    if (webpayText) {
      originalPrice = Number.parseInt(webpayText, 10);
    }

    // 3. Fallbacks si los contenedores específicos no existen (WooCommerce estándar)
    if (!price && !originalPrice) {
      const insPrice = $("ins .woocommerce-Price-amount").first().text().replace(/[^\d]/g, "");
      const delPrice = $("del .woocommerce-Price-amount").first().text().replace(/[^\d]/g, "");

      if (insPrice) price = Number.parseInt(insPrice, 10);
      if (delPrice) originalPrice = Number.parseInt(delPrice, 10);

      // Si solo hay un precio común
      if (!price) {
        const singlePrice = $(".woocommerce-Price-amount").first().text().replace(/[^\d]/g, "");
        if (singlePrice) price = Number.parseInt(singlePrice, 10);
      }
    }

    // Normalizar: originalPrice siempre debe ser el mayor o igual al cash price
    if (!originalPrice && price) originalPrice = price;
    if (price && originalPrice && price > originalPrice) {
      const temp = price;
      price = originalPrice;
      originalPrice = temp;
    }

    // --- FIN LÓGICA PRECIOS ---

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

    if ($("p.stock.out-of-stock").length > 0) {
      stock = false;
      stockQuantity = 0;
    }

    const imageUrl =
      $("img.wp-post-image").attr("src") ||
      $('meta[property="og:image"]').attr("content") ||
      $(".woocommerce-product-gallery__image img").attr("src");

    const mpn = $("span.sku").text().trim() || null;

    const descriptionText = $("#tab-description").text().trim();
    const descriptionHtml = $("#tab-description").html() || "";

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
