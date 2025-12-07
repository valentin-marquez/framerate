import { BaseCrawler, type ProductData } from "./base";

export type SpDigitalCategory =
  | "gpu"
  | "cpu"
  | "psu"
  | "motherboard"
  | "case"
  | "ram"
  | "hdd"
  | "ssd"
  | "case_fan"
  | "cpu_cooler";

// Mapeo de categorías a slugs de URL en SP Digital
export const SP_DIGITAL_CATEGORIES: Record<SpDigitalCategory, string[]> = {
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

export class SpDigitalCrawler extends BaseCrawler {
  name = "SP Digital";
  baseUrl = "https://www.spdigital.cl";
  protected useHeadless = true;
  protected concurrency = 4; // 4 páginas concurrentes para SP Digital

  constructor() {
    super();
    this.requestDelay = 1000; // Reducido de 3000 a 1000
  }

  buildCategoryUrl(categorySlug: string, page = 1): string {
    if (page === 1) {
      return `${this.baseUrl}/categories/${categorySlug}/`;
    }
    return `${this.baseUrl}/categories/${categorySlug}/${page}/`;
  }

  async getAllProductUrlsForCategory(category: SpDigitalCategory): Promise<string[]> {
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

      const html = await this.fetchHtml(categoryUrl);
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

  /**
   * Analiza el HTML de una página de producto extrayendo datos de metaetiquetas y tablas.
   * SP Digital incluye metaetiquetas con información estructurada del producto.
   */
  async parseProduct(html: string, url: string): Promise<ProductData | null> {
    try {
      // Extraer datos de metaetiquetas
      const metaData = this.extractMetaTags(html);

      // Título desde og:title (limpiando el sufijo "| SP Digital")
      const title = metaData.title?.replace(/\s*\|\s*SP Digital.*$/i, "").trim();
      if (!title) {
        this.logger.warn(`Could not extract title from meta tags, trying fallback for ${url}`);
        return this.parseProductFallback(html, url);
      }

      if (this.shouldExcludeProduct(title)) {
        return null;
      }

      // Precio efectivo (transferencia) desde metaetiqueta
      const price = metaData.price;
      if (!price) {
        this.logger.warn(`Could not extract price from meta tags, trying fallback for ${url}`);
        return this.parseProductFallback(html, url);
      }

      // Precio normal (otros medios de pago) desde el HTML
      const originalPrice = this.extractOriginalPrice(html) || price;

      // Extraer cantidad de stock real
      // SP Digital suele tener mal la metadata de stock, así que confiamos en el HTML
      const stockQuantity = this.extractStockQuantity(html);
      const hasStock = stockQuantity > 0;

      // Imagen desde og:image o media.spdigital.cl
      let imageUrl = metaData.image;
      if (!imageUrl) {
        const imageMatch = html.match(
          /<img[^>]*src="((?:https?:)?\/\/media\.spdigital\.cl\/[^"]+)"[^>]*>/,
        );
        imageUrl = imageMatch?.[1];
      }
      if (imageUrl?.startsWith("//")) {
        imageUrl = `https:${imageUrl}`;
      }

      // Extraer especificaciones de la tabla Fractal-SpecTable
      const specs = this.extractSpecsFromTable(html);

      // Agregar marca a especificaciones
      if (metaData.brand) {
        specs.brand = metaData.brand;
      }

      return {
        url,
        title,
        price,
        originalPrice,
        stock: hasStock,
        stockQuantity,
        mpn: metaData.mpn,
        imageUrl,
        specs,
      };
    } catch (error) {
      this.logger.error(`Error parsing product ${url}:`, String(error));
      return null;
    }
  }

  /**
   * Extrae la cantidad de stock disponible (Online + Tienda).
   */
  private extractStockQuantity(html: string): number {
    let totalStock = 0;

    const parseStockValue = (label: string) => {
      // Buscar la etiqueta y el contenido del div siguiente
      // Patrón: Stock online</span></span><div ...>Contenido</div>
      // Usamos \\s* para permitir espacios antes del cierre del span
      const regex = new RegExp(
        `${label}\\s*<\\/span>[\\s\\S]*?<div[^>]*>([\\s\\S]*?)<\\/div>`,
        "i",
      );
      const match = html.match(regex);

      if (match?.[1]) {
        const content = match[1].trim();

        // Si dice "No disponible", es 0
        if (content.toLowerCase().includes("no disponible")) {
          return 0;
        }

        // Intentar extraer solo los dígitos primero
        // Esto maneja "1 unidad", "10 unidades", "1", "Stock: 5", etc.
        const numberMatch = content.match(/(\d+)/);
        if (numberMatch?.[1]) {
          return Number.parseInt(numberMatch[1], 10);
        }
      }
      return 0;
    };

    totalStock += parseStockValue("Stock online");
    totalStock += parseStockValue("Stock en tienda");

    return totalStock;
  }

  /**
   * Extrae datos de las metaetiquetas del HTML.
   */
  private extractMetaTags(html: string): {
    mpn?: string;
    brand?: string;
    price?: number;
    title?: string;
    availability?: string;
    image?: string;
  } {
    const getMetaContent = (property: string): string | undefined => {
      const regex = new RegExp(`<meta[^>]*property="${property}"[^>]*content="([^"]*)"`, "i");
      const match = html.match(regex);
      return match?.[1];
    };

    const priceStr = getMetaContent("product:price:amount");
    const price = priceStr ? Number.parseInt(priceStr, 10) : undefined;

    return {
      mpn: getMetaContent("product:mfr_part_no"),
      brand: getMetaContent("product:brand"),
      price: price && !Number.isNaN(price) ? price : undefined,
      title: getMetaContent("og:title"),
      availability: getMetaContent("product:availability"),
      image: getMetaContent("og:image"),
    };
  }

  /**
   * Extrae el precio normal (no efectivo) del HTML.
   */
  private extractOriginalPrice(html: string): number | undefined {
    // Buscar el precio en el span con clase Fractal-Price--price que NO está en el contenedor de transferencia
    const priceMatch = html.match(
      /Fractal-Typography--typographyBestPriceSm[^>]*>[\s\S]*?Fractal-Price--price[^>]*>\$?([\d.,]+)/i,
    );

    if (priceMatch?.[1]) {
      const cleaned = priceMatch[1].replace(/[^\d]/g, "");
      const price = Number.parseInt(cleaned, 10);
      return Number.isNaN(price) ? undefined : price;
    }

    return undefined;
  }

  /**
   * Extrae especificaciones de la tabla Fractal-SpecTable.
   */
  private extractSpecsFromTable(html: string): Record<string, string> {
    const specs: Record<string, string> = {};

    // Buscar todas las filas de la tabla de especificaciones
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

    return specs;
  }

  /**
   * Verifica si el producto debe ser excluido basado en palabras clave en el título.
   */
  private shouldExcludeProduct(title: string): boolean {
    const excludedKeywords = ["Controladora", "Adaptador"];
    const lowerTitle = title.toLowerCase();
    return excludedKeywords.some((keyword) => lowerTitle.includes(keyword.toLowerCase()));
  }

  /**
   * Fallback para analizar productos cuando las metaetiquetas no están disponibles.
   */
  private async parseProductFallback(html: string, url: string): Promise<ProductData | null> {
    try {
      const titleMatch = html.match(
        /<h1[^>]*class="[^"]*Fractal-Typography[^"]*"[^>]*>([^<]+)<\/h1>/,
      );
      const title = titleMatch?.[1]?.trim();

      if (!title) {
        this.logger.warn(`Could not extract title from ${url}`);
        return null;
      }

      if (this.shouldExcludeProduct(title)) {
        return null;
      }

      const priceMatch = html.match(
        /<span[^>]*class="[^"]*Fractal-Price--price[^"]*"[^>]*>\$?([\d.,]+)<\/span>/,
      );

      const parsePrice = (priceStr: string | undefined): number | undefined => {
        if (!priceStr) return undefined;
        const cleaned = priceStr.replace(/[^\d]/g, "");
        const price = Number.parseInt(cleaned, 10);
        return Number.isNaN(price) ? undefined : price;
      };

      const price = parsePrice(priceMatch?.[1]);

      if (!price) {
        this.logger.warn(`Could not extract price from ${url}`);
        return null;
      }

      const imageMatch = html.match(
        /<img[^>]*src="((?:https?:)?\/\/media\.spdigital\.cl\/[^"]+)"[^>]*>/,
      );
      let imageUrl = imageMatch?.[1];
      if (imageUrl?.startsWith("//")) {
        imageUrl = `https:${imageUrl}`;
      }

      const specs = this.extractSpecsFromTable(html);

      const stockQuantity = this.extractStockQuantity(html);
      const hasStock = stockQuantity > 0;

      return {
        url,
        title,
        price,
        originalPrice: price,
        stock: hasStock,
        stockQuantity,
        mpn: specs.mpn || specs.sku,
        imageUrl,
        specs,
      };
    } catch (error) {
      this.logger.error(`Error in fallback parsing ${url}:`, String(error));
      return null;
    }
  }
}
