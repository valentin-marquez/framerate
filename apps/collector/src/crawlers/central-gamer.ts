import * as cheerio from "cheerio";
import type { Category, CategoryMap } from "@/constants/categories";
import { BaseCrawler, type ProductData } from "./base";

export const CENTRAL_GAMER_CATEGORIES: CategoryMap<string[]> = {
  gpu: ["https://centralgamer.cl/componentes-pc/tarjetas-de-video/"],
  cpu: ["https://centralgamer.cl/componentes-pc/procesadores/"],
  motherboard: ["https://centralgamer.cl/componentes-pc/placas-madre/"],
  ram: ["https://centralgamer.cl/componentes-pc/memorias-ram/"],
  psu: ["https://centralgamer.cl/componentes-pc/fuentes-de-poder/"],
  case: ["https://centralgamer.cl/componentes-pc/gabinetes-gamer/"],
  // Shared categories
  ssd: ["https://centralgamer.cl/componentes-pc/almacenamiento/"],
  hdd: ["https://centralgamer.cl/componentes-pc/almacenamiento/"],
  cpu_cooler: ["https://centralgamer.cl/componentes-pc/refrigeracion-pc/"],
  case_fan: ["https://centralgamer.cl/componentes-pc/refrigeracion-pc/"],
};

export class CentralGamerCrawler extends BaseCrawler<Category> {
  name = "CentralGamer";
  baseUrl = "https://centralgamer.cl";

  protected useHeadless = true;

  async getAllProductUrlsForCategory(category: Category): Promise<string[]> {
    const urls: string[] = [];
    const categoryUrls = CENTRAL_GAMER_CATEGORIES[category];

    if (!categoryUrls || categoryUrls.length === 0) {
      this.logger.warn(`No URLs configured for category: ${category}`);
      return [];
    }

    for (const startUrl of categoryUrls) {
      let page = 1;
      let hasNextPage = true;

      this.logger.info(`Crawling category ${category} from ${startUrl}`);

      while (hasNextPage) {
        const pageUrl = page === 1 ? startUrl : `${startUrl}page/${page}/`;

        try {
          this.logger.info(`Fetching page ${page}: ${pageUrl}`);
          // BaseCrawler's fetchHtml handles 404 by throwing? Or returning string?
          // fetchWithFetch throws on !response.ok
          const html = await this.fetchHtml(pageUrl);

          if (html.includes("Página no encontrada") || html.includes("error-404-sub-title")) {
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

          // Small delay between pages to be nice
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

  private extractUrlsFromList(html: string, category: Category): string[] {
    const $ = cheerio.load(html);
    const urls: string[] = [];

    $(".product-wrapper").each((_, el) => {
      const link = $(el).find("a.woocommerce-loop-product__link").attr("href");
      const title = $(el).find(".woocommerce-loop-product__title").text().trim();

      if (!link || !title) return;

      // Filtering based on category to avoid irrelevant items in mixed categories
      if (this.shouldInclude(title, category)) {
        urls.push(link);
      }
    });

    return urls;
  }

  private shouldInclude(title: string, category: Category): boolean {
    const lowerTitle = title.toLowerCase();

    // Almacenamiento filtering
    if (category === "ssd" || category === "hdd") {
      if (
        lowerTitle.includes("pendrive") ||
        lowerTitle.includes("microsd") ||
        lowerTitle.includes("sdxc") ||
        lowerTitle.includes(" sdhc")
      ) {
        return false;
      }
      if (
        category === "ssd" &&
        !lowerTitle.includes("ssd") &&
        !lowerTitle.includes("nvme") &&
        !lowerTitle.includes("m.2")
      )
        return false;
      if (category === "hdd" && !lowerTitle.includes("disco duro") && !lowerTitle.includes("hdd")) {
        // Handle overlap: "Disco Duro SSD" sometimes appears. Prioritize SSD check above.
        if (lowerTitle.includes("ssd")) return false;
        // If it's just "Disco Duro" without SSD, likely HDD.
        return true;
      }
    }

    // Refrigeracion filtering
    if (category === "cpu_cooler") {
      if (
        lowerTitle.includes("ventilador") &&
        !lowerTitle.includes("cpu") &&
        !lowerTitle.includes("cooler") &&
        !lowerTitle.includes("liquida")
      ) {
        // Likely a case fan ("ventilador gabinete")
        return false;
      }
    }
    if (category === "case_fan") {
      if (
        lowerTitle.includes("liquida") ||
        lowerTitle.includes("cooler cpu") ||
        (lowerTitle.includes("cooler") && !lowerTitle.includes("gabinete"))
      ) {
        return false;
      }
    }

    return true;
  }

  async parseProduct(html: string, url: string): Promise<ProductData | null> {
    const $ = cheerio.load(html);

    let title = $("h2.heading span").text().trim();
    if (!title) title = $("h1.product_title").text().trim();

    if (!title) {
      this.logger.warn(`Missing title for ${url}`);
      return null;
    }

    // 1. Price extraction
    let price: number | null = null;
    let originalPrice: number | null = null;

    // Method A: Standard hidden input/fields
    const cashPriceText = $(".precio-efectivo-valor").text().replace(/[^\d]/g, "");
    if (cashPriceText) {
      price = parseInt(cashPriceText, 10);
    }

    const normalPriceText = $(".precio-tarjeta-valor").text().replace(/[^\d]/g, "");
    if (normalPriceText) {
      originalPrice = parseInt(normalPriceText, 10);
    }

    // Method B: Raw HTML table embedded in .precio-info-raw
    if (!price) {
      const rawInfo = $(".precio-info-raw").text();
      if (rawInfo?.includes("<table")) {
        const $table = cheerio.load(rawInfo);
        $table("tr").each((_, row) => {
          const label = $table(row).find("td").eq(0).text().toLowerCase();
          const priceValText = $table(row).find("td").eq(2).text().replace(/[^\d]/g, "");
          const val = parseInt(priceValText, 10);

          if (!Number.isNaN(val)) {
            if (label.includes("transferencia")) {
              price = val;
            } else if (label.includes("tarjeta") || label.includes("webpay") || label.includes("mercado pago")) {
              if (originalPrice === null) originalPrice = val;
            }
          }
        });
      }
    }

    // Method C: Fallback to standard WooCommerce price block
    if (!price) {
      const priceElement = $("p.price ins .woocommerce-Price-amount bdi").first();
      const fallbackStr = priceElement.length
        ? priceElement.text()
        : $("p.price .woocommerce-Price-amount bdi").first().text();
      const clean = fallbackStr.replace(/[^\d]/g, "");
      if (clean) price = parseInt(clean, 10);
    }

    if (!originalPrice && price) originalPrice = price;
    if (price && originalPrice && price > originalPrice) {
      const temp = price;
      price = originalPrice;
      originalPrice = temp;
    }

    // 2. Stock extraction
    const stockElement = $(".stock.in-stock");
    const outOfStockElement = $(".stock.out-of-stock, .out-of-stock");

    let stockQuantity: number | null = null;
    let stock = false;

    // Priority 1: Explicit out of stock
    if (outOfStockElement.length > 0) {
      stock = false;
    }
    // Priority 2: Explicit in stock
    else if (stockElement.length > 0) {
      stock = true;
      const valueSpan = stockElement.find(".value");
      if (valueSpan.length > 0) {
        const val = parseInt(valueSpan.text().replace(/[^\d]/g, ""), 10);
        if (!Number.isNaN(val)) stockQuantity = val;
      } else {
        const text = stockElement.text();
        const numberMatch = text.match(/(\d+)/);
        if (numberMatch && text.toLowerCase().includes("queda")) {
          stockQuantity = parseInt(numberMatch[0], 10);
        }
      }
    }
    // Priority 3: Implicit
    else {
      const hasImmediateDelivery = $(".custom-label.success").text().toLowerCase().includes("entrega inmediata");
      const addToCartBtn = $("button.single_add_to_cart_button");
      const canAddToCart = addToCartBtn.length > 0 && !addToCartBtn.hasClass("disabled");

      if (hasImmediateDelivery || canAddToCart) {
        stock = true;
      }
    }

    // Image
    const imageUrl =
      $(".woocommerce-product-gallery__image img").first().attr("src") ||
      $('meta[property="og:image"]').attr("content");

    // Specs / Description
    // Usually in #tab-description or .product_meta
    let sku = $(".part_number_wrapper .part-number").text().trim();
    if (!sku) sku = $(".sku_wrapper .sku").text().trim();

    const specs: Record<string, string> = {};

    let manufacturer = "";
    const brandElement = $(".posted_in").first();
    if (brandElement.length && brandElement.text().includes("Marca")) {
      manufacturer = brandElement
        .find("a")
        .map((_, el) => $(el).text().trim())
        .get()
        .join(", ");
    }

    if (!manufacturer) manufacturer = this.extractManufacturer(title, sku) || "";
    if (manufacturer) specs.manufacturer = manufacturer;

    // description for context
    let descriptionText = $(".entry-product-content-section").text().trim();
    if (!descriptionText)
      descriptionText =
        $("#tab-description").text().trim() || $(".woocommerce-product-details__short-description").text().trim();
    let descriptionHtml = $(".entry-product-content-section").html() || "";
    if (!descriptionHtml) descriptionHtml = $("#tab-description").html() || "";

    return {
      url,
      title,
      price,
      originalPrice,
      stock,
      stockQuantity,
      mpn: sku || null,
      imageUrl: imageUrl || null,
      specs,
      context: {
        description_text: descriptionText,
        description_html: descriptionHtml,
      },
    };
  }

  private extractManufacturer(title: string, _sku: string): string | undefined {
    // Basic normalization or extraction can happen here or reliance on processor
    // Common brands
    const brands = [
      "Asus",
      "MSI",
      "Gigabyte",
      "ASRock",
      "Kingston",
      "Corsair",
      "Hikvision",
      "Hiksemi",
      "Adata",
      "Western Digital",
      "Seagate",
      "Intel",
      "AMD",
      "Nvidia",
      "Zotac",
      "PNY",
      "Galax",
      "Deepcool",
      "Cooler Master",
      "Lian Li",
      "Nzxt",
      "Thermaltake",
      "EVGA",
      "Seasonic",
      "Cougar",
      "Spektra",
    ];
    const lowerTitle = title.toLowerCase();
    for (const brand of brands) {
      if (lowerTitle.includes(brand.toLowerCase())) return brand;
    }
    return undefined;
  }

  async getProductUrls(html: string): Promise<string[]> {
    // This is effectively handled inside getAllProductUrlsForCategory for this crawler
    // But if needed for single page check:
    return this.extractUrlsFromList(html, "gpu"); // Category doesn't matter much if we just want URLs on page
  }
}
