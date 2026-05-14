import { OpenDBProductSchema } from "@framerate/opendb";
import * as cheerio from "cheerio";
import type { Page } from "puppeteer";
import type { CategoryMap } from "@/constants/categories";
import { BaseCrawler, type ProductData } from "./base";

// Tipos para la estructura JSON que devuelve SP Digital (Gatsby pageContext)
interface SPDigitalMetadata {
  key?: string;
  value?: string;
}
interface SPDigitalAttribute {
  attribute?: { name?: string; slug?: string };
  values?: Array<{ name?: string }>;
}
interface SPDigitalMedia {
  url?: string;
  thumbnailUrl?: string;
}
interface SPDigitalVariant {
  quantityAvailable?: number;
  quantityInStore?: number;
  quantityOnline?: number;
}
interface SPDigitalContent {
  name?: string;
  slug?: string;
  metadata?: SPDigitalMetadata[];
  attributes?: SPDigitalAttribute[];
  media?: SPDigitalMedia[];
  defaultVariant?: SPDigitalVariant;
  description?: string;
}
interface SPDigitalListItem {
  slug?: string;
}
interface SPDigitalPageContext {
  content?: SPDigitalContent & { items?: SPDigitalListItem[] };
  defaultTotalPages?: number;
  defaultTotalProducts?: number;
}
interface SPDigitalProductJson {
  result?: { pageContext?: SPDigitalPageContext };
}

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

export class SpDigitalCrawler extends BaseCrawler<string> {
  name = "SP Digital";
  baseUrl = "https://www.spdigital.cl";
  // SP Digital sirve todo via Gatsby page-data.json, pero está detrás de Cloudflare WAF que
  // bloquea fetches server-side. Estrategia: una página warm-up de Puppeteer (con stealth)
  // sirve cookies CF y desde ahí ejecutamos fetches en el contexto del browser.
  protected useHeadless = false; // No usamos el flow Puppeteer estándar de BaseCrawler
  protected concurrency = 4;
  private warmupPage: Page | null = null;

  constructor() {
    super();
    this.requestDelay = 1000;
  }

  /** Abre (una sola vez) una página de Puppeteer y la navega a la home para obtener cookies CF. */
  private async getWarmupPage(): Promise<Page> {
    if (this.warmupPage && !this.warmupPage.isClosed()) return this.warmupPage;
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(this.userAgents[0]);
    this.logger.info("Warming up SP Digital session (CF cookies)...");
    await page.goto(this.baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    this.warmupPage = page;
    return page;
  }

  /** Ejecuta fetch en el contexto del browser para reutilizar cookies CF. */
  private async fetchJsonViaBrowser<T = unknown>(url: string, referer: string): Promise<T | null> {
    const page = await this.getWarmupPage();
    return (await page.evaluate(
      async (u, ref) => {
        try {
          const r = await fetch(u, {
            headers: { Referer: ref, Accept: "application/json,*/*" },
          });
          if (!r.ok) return null;
          return (await r.json()) as unknown;
        } catch {
          return null;
        }
      },
      url,
      referer,
    )) as T | null;
  }

  /**
   * Ejecuta múltiples fetches en paralelo dentro de UN solo `page.evaluate`.
   * El browser hace multiplexing HTTP nativo: 1 IPC en vez de N, y los fetches corren
   * concurrentemente en el contexto que ya tiene cookies CF. Mucho más rápido que
   * llamar `fetchJsonViaBrowser` en loop (que serializa por el rate limit global).
   */
  private async fetchJsonBatchViaBrowser(
    jobs: Array<{ url: string; referer: string }>,
    parallelism = 6,
  ): Promise<Map<string, string | null>> {
    if (jobs.length === 0) return new Map();
    const page = await this.getWarmupPage();
    const out = await page.evaluate(
      async (items, p) => {
        const results: Record<string, string | null> = {};
        // Procesa en chunks de `p` para evitar saturar la red del browser/CF.
        for (let i = 0; i < items.length; i += p) {
          const chunk = items.slice(i, i + p);
          await Promise.all(
            chunk.map(async (j) => {
              try {
                const r = await fetch(j.url, {
                  headers: { Referer: j.referer, Accept: "application/json,*/*" },
                });
                results[j.url] = r.ok ? await r.text() : null;
              } catch {
                results[j.url] = null;
              }
            }),
          );
        }
        return results;
      },
      jobs,
      parallelism,
    );
    return new Map(Object.entries(out));
  }

  public async closeBrowser(): Promise<void> {
    this.warmupPage = null;
    await super.closeBrowser();
  }

  buildCategoryUrl(categorySlug: string, page = 1): string {
    if (page === 1) {
      return `${this.baseUrl}/categories/${categorySlug}/`;
    }
    return `${this.baseUrl}/categories/${categorySlug}/${page}/`;
  }

  /** URL del page-data.json de Gatsby para una página de categoría. */
  private buildCategoryDataUrl(categorySlug: string, page = 1): string {
    const segment = page === 1 ? "" : `${page}/`;
    return `${this.baseUrl}/page-data/categories/${categorySlug}/${segment}page-data.json`;
  }

  /** URL del page-data.json de Gatsby para un producto. */
  private buildProductDataUrl(slug: string): string {
    return `${this.baseUrl}/page-data/${slug}/page-data.json`;
  }

  async getAllProductUrlsForCategory(category: string): Promise<string[]> {
    const categorySlugs = SP_DIGITAL_CATEGORIES[category as keyof typeof SP_DIGITAL_CATEGORIES];
    const allUrls: string[] = [];

    if (!categorySlugs || categorySlugs.length === 0) {
      this.logger.warn(`Category "${category}" has no configured slugs yet`);
      return [];
    }

    this.logger.info(`Scraping category "${category}" with ${categorySlugs.length} subcategories`);

    for (const slug of categorySlugs) {
      this.logger.info(`Scraping category slug: ${slug}`);
      const urls = await this.getAllProductUrlsWithPagination(slug);
      allUrls.push(...urls);
    }

    const uniqueUrls = [...new Set(allUrls)];
    this.logger.info(`Total unique product URLs for "${category}": ${uniqueUrls.length}`);
    return uniqueUrls;
  }

  /**
   * Recorre todas las páginas de la categoría leyendo Gatsby page-data.json.
   * Cada página entrega items con slug + datos completos. defaultTotalPages dicta el límite.
   */
  async getAllProductUrlsWithPagination(categorySlug: string): Promise<string[]> {
    const allSlugs: string[] = [];
    const refererPage1 = this.buildCategoryUrl(categorySlug, 1);

    // Página 1: descubre defaultTotalPages
    const firstUrl = this.buildCategoryDataUrl(categorySlug, 1);
    const first = await this.fetchCategoryData(firstUrl, refererPage1);
    if (!first) return [];

    const totalPages = first.totalPages || 1;
    const totalProducts = first.totalProducts || first.items.length;
    this.logger.info(`Category "${categorySlug}": ${totalProducts} products in ${totalPages} pages`);

    for (const it of first.items) {
      if (it.slug) allSlugs.push(it.slug);
    }

    for (let p = 2; p <= totalPages && p <= 50; p++) {
      const pageUrl = this.buildCategoryDataUrl(categorySlug, p);
      const referer = this.buildCategoryUrl(categorySlug, p);
      const data = await this.fetchCategoryData(pageUrl, referer);
      if (!data || data.items.length === 0) break;
      for (const it of data.items) {
        if (it.slug) allSlugs.push(it.slug);
      }
    }

    return allSlugs.map((s) => `${this.baseUrl}/${s}/`);
  }

  /** Fetch + parseo seguro del page-data.json de una categoría (vía browser context). */
  private async fetchCategoryData(
    url: string,
    referer: string,
  ): Promise<{ items: SPDigitalListItem[]; totalPages: number; totalProducts: number } | null> {
    await this.waitRateLimit();
    const json = await this.fetchJsonViaBrowser<SPDigitalProductJson>(url, referer);
    if (!json) {
      this.logger.warn(`Category JSON ${url} fetch failed`);
      return null;
    }
    const ctx = json?.result?.pageContext;
    const items = ctx?.content?.items;
    if (!Array.isArray(items)) {
      this.logger.warn(`Category JSON ${url} has no items array`);
      return null;
    }
    return {
      items,
      totalPages: ctx?.defaultTotalPages || 1,
      totalProducts: ctx?.defaultTotalProducts || items.length,
    };
  }

  /**
   * Compatibilidad: extrae URLs desde el HTML de una página de categoría
   * (solo se usa si alguien llama directamente con HTML; el flujo principal usa JSON).
   */
  async getProductUrls(html: string): Promise<string[]> {
    const urls = new Set<string>();
    const re = /<a\s+href="(\/[^"]+\/)"\s+class="Fractal-ProductCard--image"/g;
    let m: RegExpExecArray | null = re.exec(html);
    while (m !== null) {
      urls.add(`${this.baseUrl}${m[1]}`);
      m = re.exec(html);
    }
    return [...urls];
  }

  // Override fetchHtml: para productos, devolvemos el page-data.json directamente (vía browser context).
  public async fetchHtml(url: string, waitForSelector?: string): Promise<string> {
    if (!url.includes("/categories/")) {
      const match = url.match(/spdigital\.cl\/([^/]+)\/?$/);
      if (match?.[1]) {
        const slug = match[1];
        const jsonUrl = this.buildProductDataUrl(slug);
        this.logger.info(`Fetching JSON for product: ${jsonUrl}`);
        await this.waitRateLimit();
        const json = await this.fetchJsonViaBrowser<unknown>(jsonUrl, `${this.baseUrl}/${slug}/`);
        if (!json) throw new Error(`Failed to fetch product JSON ${jsonUrl}`);
        return JSON.stringify(json);
      }
    }
    return super.fetchHtml(url, waitForSelector);
  }

  /**
   * Override del batch fetch: agrupa todos los URLs de productos en una sola llamada
   * `page.evaluate` con `Promise.all`. Evita el `waitRateLimit` global por item y la
   * serialización de IPC. Para URLs no-producto (categorías, etc.), cae al flow base.
   */
  public async fetchHtmlBatch(urls: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const productJobs: Array<{ originalUrl: string; jsonUrl: string; referer: string }> = [];
    const otherUrls: string[] = [];

    for (const url of urls) {
      const m = url.includes("/categories/") ? null : url.match(/spdigital\.cl\/([^/]+)\/?$/);
      if (m?.[1]) {
        const slug = m[1];
        productJobs.push({
          originalUrl: url,
          jsonUrl: this.buildProductDataUrl(slug),
          referer: `${this.baseUrl}/${slug}/`,
        });
      } else {
        otherUrls.push(url);
      }
    }

    if (productJobs.length > 0) {
      this.logger.info(`Batch fetching ${productJobs.length} product JSONs (parallelism=${this.concurrency * 2})`);
      const start = Date.now();
      const batchSize = 40; // Dispara hasta 40 a la vez por evaluate; el browser multiplexa.
      for (let i = 0; i < productJobs.length; i += batchSize) {
        const slice = productJobs.slice(i, i + batchSize);
        const fetched = await this.fetchJsonBatchViaBrowser(
          slice.map((j) => ({ url: j.jsonUrl, referer: j.referer })),
          this.concurrency * 2,
        );
        for (const job of slice) {
          const json = fetched.get(job.jsonUrl);
          if (json) results.set(job.originalUrl, json);
        }
      }
      this.logger.info(`Batch fetched ${results.size}/${productJobs.length} product JSONs in ${Date.now() - start}ms`);
    }

    // URLs no-producto: dejamos que BaseCrawler.fetchHtmlBatch las procese.
    if (otherUrls.length > 0) {
      const fallback = await super.fetchHtmlBatch(otherUrls);
      for (const [url, html] of fallback) results.set(url, html);
    }

    return results;
  }

  /**
   * Analiza el HTML (o JSON) de una página de producto.
   */
  async parseProduct(content: string, url: string): Promise<ProductData | null> {
    let result: ProductData | null = null;

    // 1. Try to parse from Framerate Injected Hydration (Puppeteer)
    const $ = cheerio.load(content);
    const hydrationScript = $("#__FRAMERATE_HYDRATION__").html();

    if (hydrationScript) {
      try {
        const { nextData } = JSON.parse(hydrationScript);
        if (nextData?.props?.pageProps?.product) {
          result = this.parseProductJson(
            { result: { pageContext: { content: nextData.props.pageProps.product } } },
            url,
          );
        }
      } catch (e) {
        this.logger.warn(`Error parsing hydration script for ${url}: ${e}`);
      }
    }

    // 2. Try to parse as JSON (Direct JSON endpoint fetch strategy)
    if (!result) {
      try {
        const data = JSON.parse(content);
        if (data?.result?.pageContext?.content) {
          result = this.parseProductJson(data, url);
        }
      } catch (_e) {
        // Not JSON
      }
    }

    // 3. Fallback to DOM Scraping
    if (!result) {
      result = await this.parseProductHtml(content, url);
    }

    // Validate with OpenDB Schema if we have a result
    if (result) {
      const validation = OpenDBProductSchema.safeParse({
        ...result,
        currency: "CLP",
        stock_level: result.stockQuantity || 0,
        availability: result.stock ? "InStock" : "OutOfStock",
        specifications: result.specs || {},
        url: result.url,
        sku: result.mpn || result.url,
      });

      if (!validation.success) {
        this.logger.warn(`Validation Failed for ${url}: ${validation.error.issues.map((i) => i.message).join(", ")}`);
      }
    }

    return result;
  }

  private parseProductJson(data: SPDigitalProductJson | SPDigitalContent, url: string): ProductData | null {
    try {
      // Support both page-data.json structure and internal props structure
      // data can be the full response object OR just the product object depending on source
      const content: SPDigitalContent =
        ("result" in data && data.result?.pageContext?.content) || (data as SPDigitalContent);
      const title = content.name;

      if (!title) return null;

      if (this.shouldExcludeProduct(title)) {
        return null;
      }

      const metadata = content.metadata || [];

      // Price
      let priceCash = 0;
      let priceNormal = 0;
      const pricingMeta = metadata.find((m) => m.key === "pricing");
      if (pricingMeta?.value) {
        try {
          const pricing = JSON.parse(pricingMeta.value);
          if (pricing["sp-digital"]) {
            priceCash = pricing["sp-digital"].cash || 0;
            priceNormal = pricing["sp-digital"].other || 0;
          }
        } catch (e) {
          this.logger.warn(`Error parsing pricing JSON for ${url}: ${e}`);
        }
      }

      // Stock
      const defaultVariant = content.defaultVariant;
      const quantityAvailable = defaultVariant?.quantityAvailable || 0;
      const quantityInStore = defaultVariant?.quantityInStore || 0;
      const quantityOnline = defaultVariant?.quantityOnline || 0;

      // Logic: if any stock is available, it's in stock.
      // Use quantityAvailable as the main stock count.
      const stockQuantity = quantityAvailable;
      const hasStock = stockQuantity > 0 || quantityInStore > 0 || quantityOnline > 0;

      // MPN / Brand
      const mpn = metadata.find((m) => m.key === "mpn")?.value || "";
      const brand = content.attributes?.find((a) => a.attribute?.slug === "brand")?.values?.[0]?.name || "";

      // Image
      const imageUrl = content.media?.[0]?.thumbnailUrl || content.media?.[0]?.url || "";

      // Specs
      const specs: Record<string, string> = {};
      if (brand) specs.brand = brand;

      if (content.attributes) {
        for (const attr of content.attributes) {
          const key = attr.attribute?.name;
          const value = attr.values?.map((v) => v.name).join(", ");
          if (key && value) {
            specs[key] = value;
          }
        }
      }

      // Context
      const descriptionBlocks = content.description
        ? ((JSON.parse(content.description) as { blocks?: Array<{ data?: { text?: string } }> })?.blocks ?? [])
        : [];
      const descriptionHtml = descriptionBlocks.map((b) => b.data?.text ?? "").join("\n");

      return {
        url,
        title,
        price: priceCash,
        originalPrice: priceNormal || priceCash,
        stock: hasStock,
        stockQuantity,
        mpn,
        imageUrl,
        specs,
        context: {
          description_html: descriptionHtml,
          description_text: descriptionHtml.replace(/<[^>]+>/g, " ").trim(),
        },
      };
    } catch (error) {
      this.logger.error(`Error parsing product JSON ${url}:`, String(error));
      return null;
    }
  }

  async parseProductHtml(html: string, url: string): Promise<ProductData | null> {
    try {
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
      type JsonLdProduct = Record<string, unknown> & {
        "@type"?: string;
        name?: string;
        image?: string | string[];
        mpn?: string;
        brand?: string | { name?: string };
        description?: string;
        offers?: { availability?: string };
      };
      scripts.each((_, script) => {
        try {
          const content = $(script).html() || "[]";
          const json = JSON.parse(content);
          const products: JsonLdProduct[] = Array.isArray(json) ? json : [json];
          const product = products.find((p) => p["@type"] === "Product");

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
              result.brand = typeof product.brand === "object" ? (product.brand.name ?? "") : product.brand;
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
    $("ul li").each((_, li) => {
      const strong = $(li).find("strong");
      if (strong.length > 0) {
        const key = strong.text().replace(":", "").trim();
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
    const excludedKeywords = ["Controladora", "Adaptador", "Soporte"];
    const lowerTitle = title.toLowerCase();
    return excludedKeywords.some((keyword) => lowerTitle.includes(keyword.toLowerCase()));
  }
}
