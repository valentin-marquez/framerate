import * as cheerio from "cheerio";
import type { Category, CategoryMap } from "@/constants/categories";
import { BaseCrawler, type ProductData } from "./base";

// Mapeo de categorías a slugs de URL en SP Digital
export const SP_DIGITAL_CATEGORIES: CategoryMap<string[]> = {
  gpu: ["componentes-tarjeta-de-video"],
  cpu: ["componentes-procesador"],
  psu: ["componentes-fuente-de-poder-fuentes-de-poder"],
  motherboard: ["componentes-placa-madre"],
  case: ["componentes-gabinetes"],
  ram: ["componentes-memorias-ram-memoria-ram-pc"],
  hdd: ["componentes-almacenamiento-hdd-disco-duro-mecanico"],
  ssd: ["componentes-almacenamiento-ssd-unidad-estado-solido"],
  case_fan: ["componentes-refrigeracion-y-ventilacion-ventilador-gabinete"],
  cpu_cooler: ["componentes-refrigeracion-y-ventilacion-disipador-cpu"],
};

export class SpDigitalCrawler extends BaseCrawler<Category> {
  name = "SP Digital";
  baseUrl = "https://www.spdigital.cl";
  protected useHeadless = true;
  protected concurrency = 2; // Reducido de 4 a 2 para evitar rate limits

  constructor() {
    super();
    this.requestDelay = 2000; // Aumentado de 1000 a 2000
  }

  buildCategoryUrl(categorySlug: string, page = 1): string {
    if (page === 1) {
      return `${this.baseUrl}/categories/${categorySlug}/`;
    }
    return `${this.baseUrl}/categories/${categorySlug}/${page}/`;
  }

  async getAllProductUrlsForCategory(category: Category): Promise<string[]> {
    const categorySlugs = SP_DIGITAL_CATEGORIES[category];
    const allUrls: string[] = [];

    if (categorySlugs.length === 0) {
      this.logger.warn(`Category "${category}" has no configured slugs yet`);
      return [];
    }

    this.logger.info(`Scraping category "${category}" with ${categorySlugs.length} subcategories`);

    for (const slug of categorySlugs) {
      this.logger.info(`Scraping category slug: ${slug}`);

      // Obtener URLs con paginación
      const urls = await this.getAllProductUrlsWithPagination(slug);
      allUrls.push(...urls);
    }

    const uniqueUrls = [...new Set(allUrls)];
    this.logger.info(`Total unique product URLs for "${category}": ${uniqueUrls.length}`);

    return uniqueUrls;
  }

  async getAllProductUrlsWithPagination(categorySlug: string): Promise<string[]> {
    const allUrls: string[] = [];
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const categoryUrl = this.buildCategoryUrl(categorySlug, page);
      this.logger.info(`Fetching page ${page}: ${categoryUrl}`);

      // Wait for product cards to ensure the list is loaded
      const html = await this.fetchHtml(categoryUrl, ".Fractal-ProductCard--image");
      const urls = await this.getProductUrls(html);

      if (urls.length === 0) {
        this.logger.info(`No products found on page ${page}, stopping pagination`);
        hasMorePages = false;
      } else {
        allUrls.push(...urls);
        this.logger.info(`Found ${urls.length} products on page ${page}`);
        page++;

        if (page > 50) {
          this.logger.warn("Reached page limit (50), stopping pagination");
          hasMorePages = false;
        }
      }
    }

    return allUrls;
  }

  async getProductUrls(html: string): Promise<string[]> {
    const urls: string[] = [];
    const productCardRegex = /<a\s+href="(\/[^"]+\/)"\s+class="Fractal-ProductCard--image"/g;
    let match = productCardRegex.exec(html);

    while (match !== null) {
      const productPath = match[1];
      const fullUrl = `${this.baseUrl}${productPath}`;
      urls.push(fullUrl);
      match = productCardRegex.exec(html);
    }

    const titleLinkRegex =
      /<div class="Fractal-ProductCard--productDescriptionTextContainer">[\s\S]*?<a\s+href="(\/[^"]+\/)"/g;
    match = titleLinkRegex.exec(html);
    while (match !== null) {
      const productPath = match[1];
      const fullUrl = `${this.baseUrl}${productPath}`;
      if (!urls.includes(fullUrl)) {
        urls.push(fullUrl);
      }
      match = titleLinkRegex.exec(html);
    }

    return urls;
  }

  // Override fetchHtml to wait for stock selector on product pages
  public async fetchHtml(url: string, waitForSelector?: string): Promise<string> {
    // If it looks like a product page (not a category page), wait for stock info
    // Category pages usually end in / or have /categories/
    if (!url.includes("/categories/") && !waitForSelector) {
      // Wait for the stock container or price
      return super.fetchHtml(url, 'div[class*="product-detail-module--availability"]');
    }
    return super.fetchHtml(url, waitForSelector);
  }

  /**
   * Analiza el HTML de una página de producto extrayendo datos usando la lógica de Tracker.
   */
  async parseProduct(html: string, url: string): Promise<ProductData | null> {
    try {
      // If we are parsing from a fresh fetch, we might want to ensure we waited for stock.
      // However, parseProduct receives HTML string, so the waiting must happen before calling this.
      // In BaseCrawler.fetchHtmlBatch, we don't pass a selector.
      // We should probably override fetchHtmlBatch or just rely on the fact that we are using Puppeteer
      // and hopefully the stock is there.
      // But to be safe, let's re-fetch if we suspect missing data? No, that's inefficient.
      // The best place to wait is in the fetch phase.

      // Since we can't easily change how fetchHtmlBatch calls fetchHtml for each URL without changing BaseCrawler significantly,
      // and we already modified BaseCrawler to accept waitForSelector, we should use it.
      // But parseProduct is called AFTER fetch.

      // Wait! BaseCrawler.fetchHtmlBatch calls this.fetchHtml(url).
      // We can override fetchHtml in SpDigitalCrawler to always pass the selector!

      const $ = cheerio.load(html);
      const result = {
        priceCash: 0,
        priceNormal: 0,
        stockQuantity: 0,
        available: false,
        title: "",
        imageUrl: "",
        mpn: "",
        brand: "",
      };

      // 1. Availability from JSON-LD
      let jsonLdDescription: string | undefined;
      const scripts = $('script[type="application/ld+json"]');
      scripts.each((_, script) => {
        try {
          const content = $(script).html() || "[]";
          const json = JSON.parse(content);
          const products = Array.isArray(json) ? json : [json];
          // biome-ignore lint/suspicious/noExplicitAny: JSON-LD structure is dynamic
          const product = products.find((p: any) => p["@type"] === "Product");

          if (product) {
            if (product.offers) {
              result.available = product.offers.availability === "https://schema.org/InStock";
            }
            if (product.name) result.title = product.name;
            if (product.image) {
              result.imageUrl = Array.isArray(product.image) ? product.image[0] : product.image;
            }
            if (product.mpn) result.mpn = product.mpn;
            if (product.brand) {
              result.brand = typeof product.brand === "object" ? product.brand.name : product.brand;
            }
            if (product.description) {
              // Keep the raw description from JSON-LD (could contain newlines/formatting)
              jsonLdDescription =
                typeof product.description === "string" ? product.description : String(product.description);
            }
          }
        } catch (_e) {
          // Ignore parse errors
        }
      });

      // 2. Price Cash (Transfer) from Meta
      const metaPrice = $('meta[property="product:price:amount"]').attr("content");
      if (metaPrice) {
        result.priceCash = Number.parseInt(metaPrice, 10) || 0;
      }

      // 3. Price Normal (Other payment methods)
      // Look for "Otros medios de pago" and find the price
      const otherPaymentSpan = $("span")
        .filter((_, el) => $(el).text().includes("Otros medios de pago"))
        .first();

      if (otherPaymentSpan.length > 0) {
        // The price is usually in a sibling or close container.
        let next = otherPaymentSpan.next();
        while (next.length > 0) {
          if (next.text().includes("$")) {
            const priceText = next.text().replace(/[^\d]/g, "");
            result.priceNormal = Number.parseInt(priceText, 10) || 0;
            break;
          }
          next = next.next();
        }
      }

      // Fallback for normal price if not found (use cash price)
      if (result.priceNormal === 0) {
        result.priceNormal = result.priceCash;
      }

      // 4. Stock Quantity
      // Sum of "Stock online" and "Stock en tienda"
      const stockSpans = $("span").filter(
        (_, el) => $(el).text().includes("Stock online") || $(el).text().includes("Stock en tienda"),
      );

      stockSpans.each((_, span) => {
        const parent = $(span).parent();
        if (parent.length > 0) {
          const quantityDiv = parent.find('div[class*="product-detail-module--availability"]');
          if (quantityDiv.length > 0) {
            const text = quantityDiv.text() || "";
            // Si dice "No disponible", es 0
            if (text.toLowerCase().includes("no disponible")) {
              return;
            }
            const match = text.match(/(\d+)/);
            if (match?.[1]) {
              result.stockQuantity += Number.parseInt(match[1], 10);
            }
          }
        }
      });

      // Fallback Title if not found in JSON-LD
      if (!result.title) {
        const metaTitle = $('meta[property="og:title"]').attr("content");
        result.title = metaTitle?.replace(/\s*\|\s*SP Digital.*$/i, "").trim() || "";
      }

      // Fallback Image if not found in JSON-LD
      if (!result.imageUrl) {
        const metaImage = $('meta[property="og:image"]').attr("content");
        result.imageUrl = metaImage || "";
      }

      // Fallback MPN/Brand from Meta
      if (!result.mpn) {
        result.mpn = $('meta[property="product:mfr_part_no"]').attr("content") || "";
      }
      if (!result.brand) {
        result.brand = $('meta[property="product:brand"]').attr("content") || "";
      }

      // Extraer especificaciones de la tabla Fractal-SpecTable (Logic from original Collector)
      const specs = this.extractSpecsFromTable(html);
      if (result.brand) {
        specs.brand = result.brand;
      }

      // Extraer descripción/contexto para IA — usar HTML del contenedor de detalles si existe, sino JSON-LD
      let descriptionContext: { description_html: string; description_text: string } | undefined;

      const detailsContainer = $('div[class*="product-detail-module--detailsContainer"]');
      if (detailsContainer.length > 0) {
        const htmlContent = detailsContainer.html() || "";
        const txt = detailsContainer.text().replace(/\s+/g, " ").trim();
        descriptionContext = { description_html: htmlContent, description_text: txt };
      } else if (jsonLdDescription) {
        const htmlContent = jsonLdDescription.trim();
        const txt = jsonLdDescription.replace(/\s+/g, " ").trim();
        descriptionContext = { description_html: htmlContent, description_text: txt };
      }

      if (this.shouldExcludeProduct(result.title)) {
        return null;
      }

      // Final check on stock
      // Logic from Tracker: if available in JSON-LD but quantity not found, assume at least 1
      if (result.available && result.stockQuantity === 0) {
        result.stockQuantity = 1;
      }

      const hasStock = result.available && result.stockQuantity > 0;

      return {
        url,
        title: result.title,
        price: result.priceCash,
        originalPrice: result.priceNormal,
        stock: hasStock,
        stockQuantity: result.stockQuantity,
        mpn: result.mpn,
        imageUrl: result.imageUrl,
        specs,
        context: descriptionContext,
      };
    } catch (error) {
      this.logger.error(`Error parsing product ${url}:`, String(error));
      return null;
    }
  }

  /**
   * Extrae especificaciones de la tabla Fractal-SpecTable y listas.
   */
  private extractSpecsFromTable(html: string): Record<string, string> {
    const specs: Record<string, string> = {};
    const $ = cheerio.load(html);

    // 1. Tabla Fractal-SpecTable (tr > td > span)
    // Patrón: <td><span>Key</span></td><td><span>Value</span></td>
    const rowRegex =
      /<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/td>[\s\S]*?<td[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/td>[\s\S]*?<\/tr>/gi;

    let match = rowRegex.exec(html);
    while (match !== null) {
      const key = match[1]?.trim();
      const value = match[2]?.trim();
      if (key && value) {
        specs[key] = value;
      }
      match = rowRegex.exec(html);
    }

    // 2. Listas (ul > li > strong: key - value)
    // Ejemplo: <li><strong>Dimensiones:</strong> 120 mm x 120 mm x 28 mm</li>
    $("ul li").each((_, li) => {
      const strong = $(li).find("strong");
      if (strong.length > 0) {
        const key = strong.text().replace(":", "").trim();
        // Obtener texto después del strong
        const value = $(li).contents().not(strong).text().trim();
        if (key && value) {
          specs[key] = value;
        }
      }
    });

    return specs;
  }

  /**
   * Verifica si el producto debe ser excluido basado en palabras clave en el título.
   */
  private shouldExcludeProduct(title: string): boolean {
    // Palabras que identifican productos que NO son relevantes para nuestras categorías (p. ej. adaptadores, soportes, controladoras)
    const excludedKeywords = ["Controladora", "Adaptador", "Soporte"];
    const lowerTitle = title.toLowerCase();
    return excludedKeywords.some((keyword) => lowerTitle.includes(keyword.toLowerCase()));
  }
}
