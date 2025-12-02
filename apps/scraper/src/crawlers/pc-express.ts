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
          const absoluteUrl = decodedHref.startsWith("http")
            ? decodedHref
            : `${this.baseUrl}${decodedHref}`;

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
      price: 0,
      stock: false,
      specs: {},
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
        if (content) {
          // "1 unidad", "2 unidades", "Sin stock"
          const match = content.match(/(\d+)\s+unidad/i);
          if (match?.[1]) {
            stockCount += Number.parseInt(match[1], 10);
          }
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

    rewriter.transform(html);

    // Post-procesamiento

    // Título: Eliminar "P/N ..."
    product.title = product.title.replace(/P\/N.*$/i, "").trim();

    // Marca
    if (brandRaw) {
      if (!product.specs) product.specs = {};
      // Usar aserción de tipo a Record<string, string> para evitar any
      (product.specs as Record<string, string>).manufacturer = brandRaw.trim();
    }

    // MPN: "Manufacturer Part Number: 90YV0N12-M0AA00"
    const mpnMatch = mpnRaw.replace(/Manufacturer Part Number:/i, "").trim();
    if (mpnMatch) {
      product.mpn = mpnMatch;
    }

    // Precios
    product.price = this.parsePrice(priceCashStr);
    product.originalPrice = this.parsePrice(priceNormalStr);

    // Stock
    product.stock = stockCount > 0;
    product.stockQuantity = stockCount;

    // Extraer especificaciones técnicas si están disponibles
    const techSpecs = this.extractTechnicalSpecs(html);
    if (Object.keys(techSpecs).length > 0) {
      product.specs = {
        ...(product.specs as Record<string, string>),
        ...techSpecs,
      };
    }

    // Validar
    if (!product.title || product.price === 0) {
      this.logger.warn(`Failed to parse product: ${url}`);
      return null;
    }

    return product;
  }

  private extractTechnicalSpecs(html: string): Record<string, string> {
    const specs: Record<string, string> = {};
    let specsHtml = "";

    if (html.includes("technical-specifications-container")) {
      const match = html.match(
        /<div[^>]*id=["']technical-specifications-container["'][^>]*>[\s\S]*?<\/div>\s*<\/div>/i,
      );
      if (match) specsHtml = match[0];
    }

    if (!specsHtml && html.includes("product-detail-specs")) {
      const match = html.match(
        /<div[^>]*id=["']product-detail-specs["'][^>]*>[\s\S]*?<\/div>\s*<\/div>/i,
      );
      if (match) specsHtml = match[0];
    }

    if (!specsHtml && html.includes("tab-description")) {
      const match = html.match(
        /<div[^>]*id=["']tab-description["'][^>]*>([\s\S]*?)(?=<div[^>]*class=["'][^"']*tab-pane[^"']*["']|<\/div>\s*<\/div>\s*<\/div>)/i,
      );
      if (match) specsHtml = match[1];
    }

    if (!specsHtml && html.includes("tab-content")) {
      const match = html.match(
        /<div[^>]*class=["'][^"']*tab-content[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|$)/i,
      );
      if (match) specsHtml = match[1];
    }

    if (!specsHtml) {
      specsHtml = html;
    }

    const spanPattern =
      /<dt[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/dt>\s*<dd[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/dd>/gi;

    for (const match of specsHtml.matchAll(spanPattern)) {
      const rawKey = match[1].trim();
      const rawValue = match[2].trim();
      if (rawKey && rawValue) {
        const normalizedKey = this.normalizeSpecKey(rawKey);
        specs[normalizedKey] = rawValue;
      }
    }

    const simplePattern = /<dt[^>]*>\s*([^<]+?)\s*<\/dt>\s*<dd[^>]*>\s*([^<]+?)\s*<\/dd>/gi;

    for (const match of specsHtml.matchAll(simplePattern)) {
      const rawKey = match[1].trim();
      const rawValue = match[2].trim();
      if (rawKey && rawValue && !specs[this.normalizeSpecKey(rawKey)]) {
        const normalizedKey = this.normalizeSpecKey(rawKey);
        specs[normalizedKey] = rawValue;
      }
    }

    const dtDdListPattern =
      /<dt[^>]*>(?:<span[^>]*>)?([^<]+)(?:<\/span>)?<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;

    for (const match of specsHtml.matchAll(dtDdListPattern)) {
      const rawKey = match[1].trim();
      const ddContent = match[2];
      const normalizedKey = this.normalizeSpecKey(rawKey);
      if (specs[normalizedKey]) continue;

      if (ddContent.includes("<li")) {
        const liPattern = /<li[^>]*>([^<]+)<\/li>/gi;
        const items: string[] = [];
        for (const liMatch of ddContent.matchAll(liPattern)) {
          const item = liMatch[1].trim();
          if (item) items.push(item);
        }
        if (items.length > 0) {
          specs[normalizedKey] = items.join(", ");
        }
      }
    }

    const tableRowPattern =
      /<tr[^>]*>\s*<td[^>]*>\s*([^<]+?)\s*<\/td>\s*<td[^>]*>\s*([^<]+?)\s*<\/td>\s*<\/tr>/gi;

    for (const match of specsHtml.matchAll(tableRowPattern)) {
      const rawKey = match[1].trim();
      const rawValue = match[2].trim();
      if (
        rawKey &&
        rawValue &&
        rawKey.toLowerCase() !== "característica" &&
        rawKey.toLowerCase() !== "detalle" &&
        !specs[this.normalizeSpecKey(rawKey)]
      ) {
        const normalizedKey = this.normalizeSpecKey(rawKey);
        specs[normalizedKey] = rawValue;
      }
    }

    this.logger.info(`Extracted ${Object.keys(specs).length} specs from product`);
    return specs;
  }

  private normalizeSpecKey(key: string): string {
    const keyMap: Record<string, string> = {
      frecuencia: "frequency",
      "frecuencia base": "frequency",
      "frecuencia turbo": "frequency_turbo",
      "frecuencia turbo máxima": "frequency_turbo",
      "boost máximo": "frequency_turbo",
      núcleos: "cores",
      hilos: "threads",
      "núcleos / hilos": "cores_threads",
      cache: "cache",
      caché: "cache",
      enchufe: "socket",
      socket: "socket",
      núcleo: "core_name",
      "proceso de manufactura": "manufacturing_process",
      tdp: "tdp",
      "smt (hyper-threading)": "smt",
      virtualización: "virtualization",
      "¿incluye cooler?": "cooler_included",
      cooler: "cooler_included",
      "gráficos integrados": "integrated_graphics",
      marca: "manufacturer",
      fabricante: "manufacturer",
      memoria: "memory",
      bus: "bus",
      gpu: "gpu_model",
      frecuencias: "frequencies",
      "frecuencias core (base / boost / oc)": "frequencies",
      "frecuencia memorias": "memory_frequency",
      "frecuencia de memoria": "memory_frequency",
      perfil: "profile",
      refrigeración: "cooling",
      slots: "slots",
      largo: "length",
      iluminación: "illumination",
      backplate: "backplate",
      "¿backplate?": "backplate",
      "conectores de energía": "power_connectors",
      "conectores de poder": "power_connectors",
      "puertos de video": "video_ports",
      potencia: "wattage",
      "potencia de salida": "wattage",
      certificación: "certification",
      certificacion: "certification",
      "factor de forma": "form_factor",
      tamaño: "form_factor",
      tamano: "form_factor",
      pfc: "pfc_active",
      "pfc activo": "pfc_active",
      "pfc activa": "pfc_active",
      tecnología: "pfc_active",
      tecnologia: "pfc_active",
      modular: "modular",
      modularidad: "modular",
      "corriente en la línea de 12 v": "rail_12v",
      "corriente 12v": "rail_12v",
      "corriente en la línea de 5 v": "rail_5v",
      "corriente 5v": "rail_5v",
      "corriente en la línea de 3.3 v": "rail_3v3",
      "corriente 3.3v": "rail_3v3",
      conectores: "storage_connectors",
      modelo: "model",
      dimensiones: "dimensions",
      chipset: "chipset",
      "slots memorias": "memory_slots",
      "canales memoria": "memory_channels",
      formato: "form_factor",
      "soporte rgb": "rgb_support",
      "puertos de energía": "power_connectors",
      "soporte sli": "sli_support",
      "soporte crossfire": "crossfire_support",
      "soporte raid": "raid_support",
      puertos: "io_ports",
      expansiones: "expansion_slots",
      "tamaño máximo de placa madre": "max_motherboard_size",
      "tamaño maximo de placa madre": "max_motherboard_size",
      "fuente de poder": "psu_included",
      "panel lateral": "side_panel",
      color: "color",
      "largo máximo de tarjeta de video": "max_gpu_length",
      "largo maximo de tarjeta de video": "max_gpu_length",
      "alto máximo de cooler": "max_cooler_height",
      "alto maximo de cooler": "max_cooler_height",
      peso: "weight",
      "ubicación de la psu": "psu_position",
      "ubicacion de la psu": "psu_position",
      "slots de expansión": "expansion_slots",
      "slots de expansion": "expansion_slots",
      bahías: "drive_bays",
      bahias: "drive_bays",
      "espacios para vent. frontales": "front_fans",
      "espacios para vent. traseros": "rear_fans",
      "espacios para vent. laterales": "side_fans",
      "espacios para vent. superiores": "top_fans",
      "espacios para vent. inferiores": "bottom_fans",
      "ventiladores incluidos": "included_fans",
      capacidad: "capacity",
      tipo: "type",
      velocidad: "speed",
      voltaje: "voltage",
      "latencia cl (cas)": "latency_cl",
      "latencia cl": "latency_cl",
      "latencia trcd": "latency_trcd",
      "latencia trp": "latency_trp",
      "latencia tras": "latency_tras",
      "soporte ecc": "ecc_support",
      "soporte full buffered": "full_buffered",
      línea: "line",
      linea: "line",
      rpm: "rpm",
      búfer: "buffer",
      bufer: "buffer",
      "¿posee dram?": "has_dram",
      "tipo memoria nand": "nand_type",
      controladora: "controller",
      "lectura secuencial (según fabricante)": "read_speed",
      "escritura secuencial (según fabricante)": "write_speed",
      "lectura secuencial": "read_speed",
      "escritura secuencial": "write_speed",
      "flujo de aire": "airflow",
      "nivel de ruido": "noise_level",
      "presión estática": "static_pressure",
      "presion estatica": "static_pressure",
      bearing: "bearing",
      rodamiento: "bearing",
      "tipo de rodamiento": "bearing",
      "¿incluye hub?": "includes_hub",
      "incluye hub": "includes_hub",
      "conexiones de poder disponibles": "power_connectors",
      "conexiones de poder": "power_connectors",
      "control de iluminación": "lighting_control",
      "control de iluminacion": "lighting_control",
      "tamaño ventilador": "fan_size",
      "tamano ventilador": "fan_size",
      altura: "height",
      "¿heatpipes?": "has_heatpipes",
      heatpipes: "has_heatpipes",
      ruido: "noise_level",
      "sockets compatibles": "compatible_sockets",
    };

    const normalized = key.toLowerCase().trim();
    return keyMap[normalized] || normalized.replace(/\s+/g, "_");
  }

  private parsePrice(priceStr: string): number {
    const clean = priceStr.replace(/[^\d]/g, "");
    return Number.parseInt(clean, 10) || 0;
  }

  private addLimitToUrl(url: string, limit: number): string {
    const urlObj = new URL(url);
    urlObj.searchParams.set("limit", String(limit));
    return urlObj.toString();
  }

  private getTotalPages(html: string): number {
    let totalPages = 1;
    const rewriter = new HTMLRewriter();
    let paginationText = "";

    rewriter.on(".row.row-flex .text-right", {
      text(text) {
        paginationText += text.text;
        if (text.lastInTextNode) {
          const match = paginationText.match(/\((\d+)\s+página[s]?\)/i);
          if (match?.[1]) {
            totalPages = Number.parseInt(match[1], 10);
          }
          paginationText = "";
        }
      },
    });

    rewriter.transform(html);

    return totalPages;
  }
}
