import { BaseCrawler, type ProductData } from "./base";

export type PcExpressCategory =
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

// Mapeo de categorías a IDs de ruta en PC-Express
export const PC_EXPRESS_CATEGORIES: Record<PcExpressCategory, string[]> = {
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

export class PcExpressCrawler extends BaseCrawler {
  name = "PC-Express";
  baseUrl = "https://tienda.pc-express.cl";

  buildCategoryUrl(pathId: string): string {
    return `${this.baseUrl}/index.php?route=product/category&path=${pathId}`;
  }

  async getAllProductUrlsForCategory(category: PcExpressCategory): Promise<string[]> {
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

    let priceCashStr = "";
    let priceNormalStr = "";
    let stockCount = 0;
    let mpnRaw = "";
    let brandRaw = "";
    let titleCaptured = false;

    const rewriter = new HTMLRewriter();

    // Título - capturar solo el primer h1 para evitar duplicados
    rewriter.on("h1.rm-product-page__title", {
      element() {
        if (product.title.trim()) {
          titleCaptured = true;
        }
      },
      text(text) {
        if (!titleCaptured) {
          product.title += text.text;
        }
      },
    });

    // Marca
    rewriter.on(".rm-product__brand span a", {
      text(text) {
        brandRaw += text.text;
      },
    });

    // MPN
    rewriter.on(".rm-product__mpn", {
      text(text) {
        mpnRaw += text.text;
      },
    });

    // Precio Efectivo
    rewriter.on(".rm-product__price--cash h3", {
      text(text) {
        priceCashStr += text.text;
      },
    });

    // Precio Normal
    rewriter.on(".rm-product__price--normal h3", {
      text(text) {
        priceNormalStr += text.text;
      },
    });

    // Stock
    rewriter.on("span[id^='stock-sucursal-']", {
      text(text) {
        const content = text.text.trim();
        if (!content) return;
        // Match "+20 unidades" or "20 unidades" or "20"
        const match = content.match(/\+?(\d+)/);
        if (match?.[1]) {
          stockCount += Number.parseInt(match[1], 10);
        } else if (/sin stock/i.test(content)) {
          // explicit no stock -> no-op
        }
      },
    });

    // Imagen
    rewriter.on(".thumbnails img", {
      element(el) {
        const src = el.getAttribute("src");
        if (src && !product.imageUrl) {
          product.imageUrl = src;
        }
      },
    });

    // Also fallback to og:image if no thumbnail found
    rewriter.transform(html);

    if (!product.imageUrl) {
      const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i);
      if (ogMatch?.[1]) product.imageUrl = ogMatch[1];
    }

    // Note: we call transform earlier when handling image fallback

    // Post-procesamiento

    // Título: Eliminar "P/N ..."
    product.title = product.title.replace(/P\/N.*$/i, "").trim();

    // Marca
    if (brandRaw) {
      if (!product.specs) product.specs = {};
      (product.specs as Record<string, string>).manufacturer = brandRaw.trim();
    } else {
      // Fallback: try parsing the 'Marca' field in the codes block
      const matchBrand = html.match(
        /<p[^>]*>\s*<span[^>]*>\s*Marca\s*<\/span>\s*:\s*(?:<span[^>]*>\s*<a[^>]*>([^<]+)<\/a>\s*<\/span>|([^<]+))\s*<\/p>/i,
      );
      const brandVal = matchBrand?.[1] || matchBrand?.[2];
      if (brandVal) {
        if (!product.specs) product.specs = {};
        (product.specs as Record<string, string>).manufacturer = brandVal.trim();
      }
    }

    // MPN: try raw selector first and fallback to the 'codes' block in the page
    const mpnMatch = (() => {
      const m = mpnRaw.replace(/Manufacturer Part Number:/i, "").trim();
      if (m) return m;
      const matchHtml = html.match(/<p[^>]*>\s*<span[^>]*>\s*MPN\s*<\/span>\s*:\s*([^<]*)<\/p>/i);
      if (matchHtml?.[1]) return matchHtml[1].trim();
      return null;
    })();

    if (!mpnMatch) {
      this.logger.warn(`MPN not found or empty for product: ${url}. Continuing without MPN.`);
      product.mpn = null;
    } else {
      product.mpn = mpnMatch;
    }

    // Precios: try parsed selectors, fallback to price blocks and JSON-LD
    let cash = this.parsePrice(priceCashStr);
    let normal = this.parsePrice(priceNormalStr);

    // Parse price blocks if missing
    if (cash === null || normal === null) {
      const priceBlockRegex =
        /<div[^>]*class=["'][^"']*rm-product-page__price[^"']*["'][^>]*>[\s\S]*?<h3[^>]*class=["']?([^"'>]*)["']?[^>]*>([^<]+)<\/h3>/gi;
      let m: RegExpExecArray | null = null;
      for (;;) {
        m = priceBlockRegex.exec(html);
        if (m === null) break;
        const classes = (m[1] || "").toLowerCase();
        const text = m[2] || "";
        const parsed = this.parsePrice(text);
        if (classes.includes("text-primary") && cash === null) cash = parsed;
        else if (!classes.includes("text-primary") && normal === null) normal = parsed;
      }
    }

    // JSON-LD fallback
    if ((cash === null || normal === null) && /<script[^>]*type=["']application\/ld\+json["'][^>]*>/i.test(html)) {
      const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      if (jsonLdMatch?.[1]) {
        try {
          const ld = JSON.parse(jsonLdMatch[1]);
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
            if (priceVal && cash === null) cash = Number.parseInt(String(priceVal), 10) || null;
            const sku = (productLd as unknown as Record<string, unknown>).sku;
            if (sku && !product.mpn) product.mpn = String(sku);
          }
        } catch (_e) {
          // ignore malformed JSON-LD
        }
      }
    }

    product.price = cash;
    product.originalPrice = normal ?? cash;

    // Stock: consider counts and add-to-cart button as indicator
    const hasAddToCart = /id=["']button-cart["']|add-to-cart-btn/.test(html);
    product.stock = stockCount > 0 || hasAddToCart;
    product.stockQuantity = stockCount > 0 ? stockCount : null;

    // Extraer especificaciones técnicas si están disponibles (tabla o dt/dd)
    const techSpecs = this.extractTechnicalSpecs(html);
    if (Object.keys(techSpecs).length > 0) {
      product.specs = {
        ...(product.specs as Record<string, string>),
        ...techSpecs,
      };
    }

    // Basic validation: require title and an image (try og:image fallback earlier)
    if (!product.title) {
      this.logger.warn(`Failed to parse product: ${url} missing title`);
      return null;
    }
    if (!product.imageUrl) {
      this.logger.warn(`Failed to parse product: ${url} missing image`);
      return null;
    }

    return product;
  }

  private extractTechnicalSpecs(html: string): Record<string, string> {
    const specs: Record<string, string> = {};

    // 1) Table rows pattern with <span>Key</span> / <span>Value</span>
    const rowRegex =
      /<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/td>[\s\S]*?<td[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/td>[\s\S]*?<\/tr>/gi;
    let match: RegExpExecArray | null = null;
    for (;;) {
      match = rowRegex.exec(html);
      if (match === null) break;
      const key = match[1]?.trim();
      const value = match[2]?.trim();
      if (key && value) specs[key] = value;
    }

    // 2) dt / dd pairs fallback
    const dtRegex = /<dt[^>]*>\s*([^<]+?)\s*<\/dt>\s*<dd[^>]*>\s*([\s\S]*?)\s*<\/dd>/gi;
    for (;;) {
      match = dtRegex.exec(html);
      if (match === null) break;
      const key = match[1]?.trim();
      const value = match[2]?.replace(/<[^>]+>/g, "").trim();
      if (key && value && !specs[key]) specs[key] = value;
    }

    // 3) Simple table row fallback (td,td)
    const simpleRowRegex = /<tr[^>]*>\s*<td[^>]*>\s*([^<]+?)\s*<\/td>\s*<td[^>]*>\s*([^<]+?)\s*<\/td>\s*<\/tr>/gi;
    for (;;) {
      match = simpleRowRegex.exec(html);
      if (match === null) break;
      const key = match[1]?.trim();
      const value = match[2]?.trim();
      if (key && value && !specs[key]) specs[key] = value;
    }

    this.logger.info(`Extracted ${Object.keys(specs).length} specs from product`);
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
