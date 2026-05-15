import * as cheerio from "cheerio";
import { isAllowedForCategory, isMpnBlocked } from "@/collector/domain/category-filters";
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

      const urls = await this.getCategoryProductUrls(categoryUrl, category);
      allUrls.push(...urls);
    }

    const uniqueUrls = [...new Set(allUrls)];
    this.logger.info(`Total unique product URLs for "${category}": ${uniqueUrls.length}`);

    return uniqueUrls;
  }

  /** Obtiene URLs de productos con paginación automática */
  async getCategoryProductUrls(categoryUrl: string, category?: Category): Promise<string[]> {
    const allUrls: string[] = [];
    const limit = 100;

    const urlWithLimit = this.addLimitToUrl(categoryUrl, limit);

    this.logger.info(`Starting scraping of category: ${urlWithLimit}`);

    const firstPageHtml = await this.fetchHtml(urlWithLimit);
    const firstPageUrls = this.filterEntriesByCategory(this.extractListingEntries(firstPageHtml), category);
    allUrls.push(...firstPageUrls);

    const totalPages = this.getTotalPages(firstPageHtml);
    this.logger.info(`Total pages found: ${totalPages}`);

    for (let page = 2; page <= totalPages; page++) {
      const pageUrl = `${urlWithLimit}&page=${page}`;
      this.logger.info(`Fetching page ${page}/${totalPages}: ${pageUrl}`);

      const pageHtml = await this.fetchHtml(pageUrl);
      const pageEntries = this.extractListingEntries(pageHtml);
      const pageUrls = this.filterEntriesByCategory(pageEntries, category);

      this.logger.info(
        `Found ${pageEntries.length} entries on page ${page}, ${pageUrls.length} survive category filter`,
      );
      if (pageEntries.length === 0) {
        this.logger.warn(`No product entries found on page ${page}, stopping pagination early.`);
        break;
      }

      allUrls.push(...pageUrls);
    }

    this.logger.info(`Total product URLs found: ${allUrls.length}`);
    return allUrls;
  }

  /**
   * `getProductUrls` se mantiene por el contrato de `BaseCrawler` y devuelve
   * sólo URLs; el filtrado por categoría se hace en `getCategoryProductUrls`
   * donde sí conocemos el `category` esperado.
   */
  async getProductUrls(html: string): Promise<string[]> {
    return this.extractListingEntries(html).map((e) => e.url);
  }

  /**
   * Extrae los pares {url, title} de una página de listado. El título suele
   * estar en el anchor `.product-list__name a`; el href está disponible tanto
   * ahí como en el thumbnail anchor — dedupeamos por URL.
   */
  private extractListingEntries(html: string): Array<{ url: string; title: string }> {
    const titleByUrl = new Map<string, string>();

    const rewriter = new HTMLRewriter();

    const recordUrl = (link: string | null) => {
      if (!link) return null;
      const decodedHref = link.replace(/&amp;/g, "&");
      const absoluteUrl = decodedHref.startsWith("http") ? decodedHref : `${this.baseUrl}${decodedHref}`;
      if (!titleByUrl.has(absoluteUrl)) titleByUrl.set(absoluteUrl, "");
      return absoluteUrl;
    };

    rewriter.on(".product-list__item .product-list__image a", {
      element: (element) => {
        recordUrl(element.getAttribute("href"));
      },
    });

    // El anchor del nombre suele llevar el título como texto. Lo capturamos
    // por concatenación de chunks de texto vía el handler `text`.
    let currentUrl: string | null = null;
    let currentTitle = "";
    rewriter.on(".product-list__name a", {
      element: (element) => {
        // Cierra el entry previo si hay alguno colgando.
        if (currentUrl) {
          const existing = titleByUrl.get(currentUrl) ?? "";
          if (!existing && currentTitle) titleByUrl.set(currentUrl, currentTitle.trim());
        }
        currentUrl = recordUrl(element.getAttribute("href"));
        currentTitle = "";
      },
      text: (chunk) => {
        if (currentUrl) currentTitle += chunk.text;
        if (chunk.lastInTextNode && currentUrl) {
          const existing = titleByUrl.get(currentUrl) ?? "";
          if (!existing && currentTitle) titleByUrl.set(currentUrl, currentTitle.trim());
        }
      },
    });

    rewriter.transform(html);

    // Flush para la última entry si quedó colgando.
    if (currentUrl) {
      const existing = titleByUrl.get(currentUrl) ?? "";
      if (!existing && currentTitle) titleByUrl.set(currentUrl, currentTitle.trim());
    }

    return [...titleByUrl.entries()].map(([url, title]) => ({ url, title }));
  }

  /**
   * Aplica `isAllowedForCategory` a cada entry. Si no hay título o no se pasa
   * `category` (caller legacy), pasa todo y deja que el pipeline decida.
   */
  private filterEntriesByCategory(entries: Array<{ url: string; title: string }>, category?: Category): string[] {
    if (!category) return entries.map((e) => e.url);

    const surviving: string[] = [];
    let dropped = 0;
    for (const entry of entries) {
      // Sin título no podemos juzgar — dejar pasar; el pipeline lo validará tras parseo.
      if (!entry.title) {
        surviving.push(entry.url);
        continue;
      }
      const verdict = isAllowedForCategory(entry.title, category);
      if (!verdict.allowed) {
        dropped++;
        this.logger.info(
          `Dropping at discovery [${category}] "${entry.title}" :: ${verdict.reason ?? "rechazado"} (${entry.url})`,
        );
        continue;
      }
      surviving.push(entry.url);
    }
    if (dropped > 0) this.logger.info(`Discovery filter dropped ${dropped}/${entries.length} entries for ${category}`);
    return surviving;
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

    // Brand / MPN / Código se agrupan en .rm-product-page__codes
    // Estructura: <p><span class="fw-medium">Etiqueta</span>: valor</p>
    const codes = this.extractCodes($);
    const brandRaw = codes.marca ?? "";
    let mpnRaw = codes.mpn ?? "";

    // OpenCart productId: data-product-id en #product-description, o ?product_id= en la URL
    const productId =
      $("#product-description").attr("data-product-id") ||
      (() => {
        try {
          return new URL(url).searchParams.get("product_id");
        } catch {
          return null;
        }
      })();

    // Fallback de MPN: usar productId si no se encontró
    if (!mpnRaw && productId) mpnRaw = `PCX-${productId}`;
    product.mpn = mpnRaw || null;

    // Hard MPN blocklist: PC Express archiva accesorios (risers, NVLink bridges,
    // módulos TPM...) bajo la categoría padre (gpu / motherboard). Cortamos acá
    // para ahorrar la descarga del HTML de descripción y el round-trip de pipeline.
    if (isMpnBlocked(product.mpn)) {
      this.logger.info(`Skipping blocked MPN at crawler: ${product.mpn} (${url})`);
      return null;
    }

    // Precios: 2 contenedores .rm-product-page__price (cash con h3.text-primary, normal sin)
    let cash: number | null = null;
    let normal: number | null = null;
    $(".rm-product-page__prices .rm-product-page__price h3").each((_, el) => {
      const h3 = $(el);
      const price = this.parsePrice(h3.text());
      if (h3.hasClass("text-primary")) {
        if (cash === null) cash = price;
      } else if (normal === null) {
        normal = price;
      }
    });

    product.price = cash;
    product.originalPrice = normal ?? cash;

    // Stock por sucursal: span#stock-sucursal-N con texto "X unidades" o "Sin stock"
    let stockCount = 0;
    $('span[id^="stock-sucursal-"]').each((_, el) => {
      const text = $(el).text().trim();
      const match = text.match(/\+?(\d+)/);
      if (match) stockCount += Number(match[1]);
    });

    const hasAddToCart = $("#button-cart, .add-to-cart-btn").length > 0;
    product.stock = stockCount > 0 || hasAddToCart;
    product.stockQuantity = stockCount > 0 ? stockCount : null;

    // Imagen: preferir el <a> padre (full-size) sobre el thumbnail
    product.imageUrl =
      $(".thumbnails a").first().attr("href") ||
      $(".thumbnails img").first().attr("src") ||
      $('meta[property="og:image"]').attr("content") ||
      null;

    // Specs: filtrar dimensiones de embalaje que no son specs técnicos del producto
    if (brandRaw) product.specs = { manufacturer: brandRaw };
    const techSpecs = this.extractTechnicalSpecs($);
    const packagingKeys = ["ancho", "alto", "largo", "peso", "profundidad"];
    for (const key of Object.keys(techSpecs)) {
      if (packagingKeys.includes(key.toLowerCase())) {
        delete techSpecs[key];
      }
    }
    product.specs = { ...product.specs, ...techSpecs };

    // Context: la descripción se carga vía JS (Vue component) y no está en el HTML estático.
    // Llamamos directamente al endpoint AJAX que usa el frontend.
    if (productId) {
      try {
        const descUrl = `${this.baseUrl}/index.php?route=product/product/description&product_id=${productId}`;
        const descRes = await fetch(descUrl);
        if (descRes.ok) {
          const descJson = (await descRes.json()) as { success?: boolean; description?: string };
          if (descJson.success && descJson.description) {
            const desc$ = cheerio.load(descJson.description);
            product.context = {
              description_html: descJson.description,
              description_text: desc$.text().replace(/\s+/g, " ").trim(),
            };

            // Extraer specs técnicos de la tabla en la descripción
            const descSpecs = this.extractTechnicalSpecs(desc$);
            if (Object.keys(descSpecs).length > 0) {
              product.specs = { ...product.specs, ...descSpecs };
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch description for product ${productId}: ${(err as Error).message}`);
      }
    }

    // Limpiar P/N del título
    product.title = product.title.replace(/P\/N.*$/i, "").trim();

    if (!product.title || !product.imageUrl) {
      this.logger.warn(`Failed to parse product: ${url} missing title or image`);
      return null;
    }

    return product;
  }

  /**
   * Extrae el bloque de códigos (Marca / MPN / Código) de la cabecera del producto.
   * Estructura: <div class="rm-product-page__codes"><p><span class="fw-medium">Marca</span>: <a>VALOR</a></p>...</div>
   */
  private extractCodes($: cheerio.CheerioAPI): { marca?: string; mpn?: string; codigo?: string } {
    const out: { marca?: string; mpn?: string; codigo?: string } = {};
    $(".rm-product-page__codes p").each((_, el) => {
      const $p = $(el);
      const label = $p.find("span.fw-medium").first().text().trim().toLowerCase();
      // Valor = texto del <p> sin la etiqueta inicial
      const value = $p
        .text()
        .replace(/^\s*[^:]+:\s*/, "")
        .trim();
      if (!value) return;
      if (label === "marca") out.marca = value;
      else if (label === "mpn") out.mpn = value;
      else if (label === "código" || label === "codigo") out.codigo = value;
    });
    return out;
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
