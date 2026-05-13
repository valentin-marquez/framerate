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

/**
 * Mapeo de categorías internas a slugs de la WC Store API.
 * El listado HTML está bajo /componentes-pc/<slug>/ pero la API expone los slugs sin prefijo.
 */
const CENTRAL_GAMER_API_SLUGS: CategoryMap<string[]> = {
  gpu: ["tarjetas-de-video"],
  cpu: ["procesadores"],
  motherboard: ["placas-madre"],
  ram: ["memorias-ram"],
  psu: ["fuentes-de-poder"],
  case: ["gabinetes-gamer"],
  ssd: ["almacenamiento"],
  hdd: ["almacenamiento"],
  cpu_cooler: ["refrigeracion-pc"],
  case_fan: ["refrigeracion-pc"],
};

interface WcStoreProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  sku?: string;
}

export class CentralGamerCrawler extends BaseCrawler<Category> {
  name = "CentralGamer";
  baseUrl = "https://centralgamer.cl";

  // El sitio expone WooCommerce Store API público (`/wp-json/wc/store/v1/...`) y devuelve
  // todo el detalle por categoría sin necesidad de JS. parseProduct sigue leyendo HTML
  // porque el precio efectivo (transferencia, -5%) sólo está en el HTML server-rendered
  // (`.precio-info-raw`), no en la API.
  protected useHeadless = false;
  protected concurrency = 4;

  async getAllProductUrlsForCategory(category: Category): Promise<string[]> {
    const slugs = CENTRAL_GAMER_API_SLUGS[category];
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
        if (this.shouldInclude(p.name, category)) urls.add(p.permalink);
      }
    }
    return [...urls];
  }

  /** Recorre la WC Store API para obtener todos los productos de una categoría (con paginación). */
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

  /**
   * Compatibilidad: extrae URLs de productos desde el HTML de una página de categoría.
   * El flujo principal usa la API; esto sólo se invoca si alguien pasa HTML directamente.
   */
  async getProductUrls(html: string): Promise<string[]> {
    const $ = cheerio.load(html);
    const urls = new Set<string>();
    $(".product-wrapper a.woocommerce-loop-product__link").each((_, a) => {
      const href = $(a).attr("href");
      if (href) urls.add(href);
    });
    return [...urls];
  }
}
