import type { Json, TablesInsert } from "@framerate/db";
import type { BaseCrawler, ProductData } from "@/crawlers/base";
import {
  PC_EXPRESS_CATEGORIES,
  type PcExpressCategory,
  PcExpressCrawler,
} from "@/crawlers/pc-express";
import {
  SP_DIGITAL_CATEGORIES,
  type SpDigitalCategory,
  SpDigitalCrawler,
} from "@/crawlers/sp-digital";
import { Logger } from "@/lib/logger";
import { uploadProductImage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import {
  CaseFanIAExtractor,
  CaseFanProcessor,
  CaseIAExtractor,
  CaseProcessor,
  CpuCoolerIAExtractor,
  CpuCoolerProcessor,
  CpuIAExtractor,
  CpuProcessor,
  GpuIAExtractor,
  GpuProcessor,
  HddIAExtractor,
  HddProcessor,
  MotherboardIAExtractor,
  MotherboardProcessor,
  normalizeTitle,
  PsuIAExtractor,
  PsuProcessor,
  RamIAExtractor,
  RamProcessor,
  SsdIAExtractor,
  SsdProcessor,
} from "@/processors";
import type { CrawlerType, CollectorJobData } from "@/queues";

declare var self: Worker;

const logger = new Logger("Worker");

const caseIAExtractor = new CaseIAExtractor();
const caseFanIAExtractor = new CaseFanIAExtractor();
const cpuCoolerIAExtractor = new CpuCoolerIAExtractor();
const cpuIAExtractor = new CpuIAExtractor();
const gpuIAExtractor = new GpuIAExtractor();
const hddIAExtractor = new HddIAExtractor();
const motherboardIAExtractor = new MotherboardIAExtractor();
const psuIAExtractor = new PsuIAExtractor();
const ramIAExtractor = new RamIAExtractor();
const ssdIAExtractor = new SsdIAExtractor();

// Caché en memoria para marcas (evita condiciones de carrera)
const brandCache = new Map<string, string>(); // slug -> id
const brandPendingPromises = new Map<string, Promise<string | null>>(); // slug -> promise

// Definiciones de tipos
type CategorySlug =
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

interface CategoryConfig {
  slug: CategorySlug;
  name: string;
}

interface ProcessingResult {
  success: boolean;
  productId?: string;
  listingId?: string;
  error?: string;
}

interface BatchResult {
  url: string;
  result: ProcessingResult;
}

interface JobResult {
  status: "success" | "error";
  crawler: CrawlerType;
  categories: string[];
  results: Record<string, number>;
  totalCount: number;
  duration: number;
  error?: string;
}

// Configuración
const CATEGORY_CONFIG: Record<CategorySlug, CategoryConfig> = {
  gpu: { slug: "gpu", name: "Graphics Card" },
  cpu: { slug: "cpu", name: "Processor" },
  psu: { slug: "psu", name: "Power Supply" },
  motherboard: { slug: "motherboard", name: "Motherboard" },
  case: { slug: "case", name: "Case" },
  ram: { slug: "ram", name: "RAM" },
  hdd: { slug: "hdd", name: "HDD" },
  ssd: { slug: "ssd", name: "SSD" },
  case_fan: { slug: "case_fan", name: "Case Fan" },
  cpu_cooler: { slug: "cpu_cooler", name: "CPU Cooler" },
};

const BATCH_SIZE = 4;

// Operaciones de base de datos
async function getOrCreateCategory(slug: CategorySlug): Promise<string | null> {
  const config = CATEGORY_CONFIG[slug];

  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", config.slug)
    .single();

  if (existing) return existing.id;

  const insert: TablesInsert<"categories"> = {
    name: config.name,
    slug: config.slug,
  };

  const { data: created, error } = await supabase
    .from("categories")
    .insert(insert)
    .select("id")
    .single();

  if (error) {
    // Manejar condición de carrera - la categoría podría haber sido creada por otra petición
    if (error.code === "23505") {
      const { data: retryExisting } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", config.slug)
        .single();

      if (retryExisting) return retryExisting.id;
    }
    logger.error(`Failed to create category ${slug}`, error.message);
    return null;
  }

  return created?.id ?? null;
}

async function getOrCreateBrandInternal(
  normalizedName: string,
  slug: string,
): Promise<string | null> {
  // Intentar encontrar marca existente por slug (más confiable ya que es restricción única)
  const { data: existing } = await supabase.from("brands").select("id").eq("slug", slug).single();

  if (existing) {
    brandCache.set(slug, existing.id);
    return existing.id;
  }

  // Intentar insertar, manejando condición de carrera
  const insert: TablesInsert<"brands"> = {
    name: normalizedName,
    slug: slug,
  };

  const { data: created, error } = await supabase
    .from("brands")
    .insert(insert)
    .select("id")
    .single();

  if (error) {
    // Si hay error de clave duplicada, la marca fue creada por otra petición concurrente
    // Esperar brevemente consistencia de BD y reintentar
    if (error.code === "23505") {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const { data: retryExisting } = await supabase
        .from("brands")
        .select("id")
        .eq("slug", slug)
        .single();

      if (retryExisting) {
        brandCache.set(slug, retryExisting.id);
        return retryExisting.id;
      }
    }
    logger.error(`Failed to create brand ${normalizedName}`, error.message);
    return null;
  }

  if (created?.id) {
    brandCache.set(slug, created.id);
  }
  return created?.id ?? null;
}

async function getOrCreateBrand(brandName: string): Promise<string | null> {
  const normalizedName = brandName.trim() || "Generic";
  const slug = normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // Revisar caché en memoria primero
  const cached = brandCache.get(slug);
  if (cached) return cached;

  // Revisar si ya hay una promesa pendiente para este slug (deduplicación)
  const pending = brandPendingPromises.get(slug);
  if (pending) return pending;

  // Crear nueva promesa y almacenarla para prevenir peticiones concurrentes duplicadas
  const promise = getOrCreateBrandInternal(normalizedName, slug);
  brandPendingPromises.set(slug, promise);

  try {
    const result = await promise;
    return result;
  } finally {
    // Limpiar promesa pendiente al finalizar
    brandPendingPromises.delete(slug);
  }
}

async function getStoreId(slug: string): Promise<string | null> {
  const { data, error } = await supabase.from("stores").select("id").eq("slug", slug).single();

  if (error || !data) {
    logger.error(`Store '${slug}' not found in DB`);
    return null;
  }

  return data.id;
}

async function findExistingProduct(mpn: string): Promise<string | null> {
  const { data } = await supabase.from("products").select("id").eq("mpn", mpn).single();

  return data?.id ?? null;
}

async function createProduct(
  product: ProductData,
  category: CategorySlug,
  categoryId: string,
  brandId: string,
  normalizedSpecs: unknown,
  imageUrl: string | null,
): Promise<string | null> {
  // Extraer manufacturer de specs para ayudar a la normalización del título
  const specs = normalizedSpecs as Record<string, unknown>;
  const manufacturer = (specs?.manufacturer as string) || undefined;

  const normalizedTitle = normalizeTitle(product.title, category, product.mpn, manufacturer);
  const insert: TablesInsert<"products"> = {
    name: normalizedTitle,
    slug: `${normalizedTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
    mpn: product.mpn ?? null,
    category_id: categoryId,
    brand_id: brandId,
    image_url: imageUrl,
    specs: normalizedSpecs as Json,
  };

  const { data, error } = await supabase.from("products").insert(insert).select("id").single();

  if (error) {
    logger.error(`Failed to create product: ${product.title}`, error.message);
    return null;
  }

  return data?.id ?? null;
}

async function updateProductSpecs(productId: string, specs: unknown): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({ specs: specs as Json })
    .eq("id", productId);

  if (error) {
    logger.error(`Failed to update product specs: ${productId}`, error.message);
  }
}

async function upsertListing(
  product: ProductData,
  productId: string,
  storeId: string,
): Promise<string | null> {
  const insert: TablesInsert<"listings"> = {
    store_id: storeId,
    product_id: productId,
    url: product.url,
    external_id: product.url,
    price_cash: product.price,
    price_normal: product.originalPrice ?? product.price,
    is_active: product.stock,
    stock_quantity: product.stockQuantity ?? null,
    last_scraped_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("listings")
    .upsert(insert, { onConflict: "store_id,external_id" })
    .select("id")
    .single();

  if (error) {
    logger.error(`Failed to upsert listing: ${product.url}`, error.message);
    return null;
  }

  return data?.id ?? null;
}

async function recordPriceHistory(
  listingId: string,
  priceCash: number,
  priceNormal: number,
): Promise<void> {
  const insert: TablesInsert<"price_history"> = {
    listing_id: listingId,
    price_cash: priceCash,
    price_normal: priceNormal,
  };

  await supabase.from("price_history").insert(insert);
}

// Normalización de especificaciones
type SpecProcessor = {
  normalize: (specs: Record<string, string>, title?: string) => unknown;
};

const SPEC_PROCESSORS: Record<CategorySlug, SpecProcessor> = {
  gpu: GpuProcessor,
  cpu: CpuProcessor,
  psu: PsuProcessor,
  motherboard: MotherboardProcessor,
  case: CaseProcessor,
  ram: RamProcessor,
  hdd: HddProcessor,
  ssd: SsdProcessor,
  case_fan: CaseFanProcessor,
  cpu_cooler: CpuCoolerProcessor,
};

async function normalizeSpecs(
  category: CategorySlug,
  rawSpecs: Record<string, string>,
  title: string,
  mpn?: string | null,
): Promise<unknown> {
  if (category === "hdd" && mpn) {
    const specs = await hddIAExtractor.extract(
      mpn,
      `Title: ${title}\nSpecs: ${JSON.stringify(rawSpecs)}`,
    );
    if (specs) return specs;
  }

  if (category === "ssd" && mpn) {
    const specs = await ssdIAExtractor.extract(
      mpn,
      `Title: ${title}\nSpecs: ${JSON.stringify(rawSpecs)}`,
    );
    if (specs) return specs;
  }

  if (category === "ram" && mpn) {
    const specs = await ramIAExtractor.extract(
      mpn,
      `Title: ${title}\nSpecs: ${JSON.stringify(rawSpecs)}`,
    );
    if (specs) return specs;
  }

  if (category === "motherboard" && mpn) {
    const specs = await motherboardIAExtractor.extract(
      mpn,
      `Title: ${title}\nSpecs: ${JSON.stringify(rawSpecs)}`,
    );
    if (specs) return specs;
  }
  if (category === "gpu" && mpn) {
    const specs = await gpuIAExtractor.extract(
      mpn,
      `Title: ${title}\nSpecs: ${JSON.stringify(rawSpecs)}`,
    );
    if (specs) return specs;
  }

  if (category === "cpu" && mpn) {
    const specs = await cpuIAExtractor.extract(
      mpn,
      `Title: ${title}\nSpecs: ${JSON.stringify(rawSpecs)}`,
    );
    if (specs) return specs;
  }

  if (category === "psu" && mpn) {
    const specs = await psuIAExtractor.extract(
      mpn,
      `Title: ${title}\nSpecs: ${JSON.stringify(rawSpecs)}`,
    );
    if (specs) return specs;
  }

  if (category === "case_fan" && mpn) {
    const specs = await caseFanIAExtractor.extract(
      mpn,
      `Title: ${title}\nSpecs: ${JSON.stringify(rawSpecs)}`,
    );
    if (specs) return specs;
  }

  if (category === "case" && mpn) {
    const specs = await caseIAExtractor.extract(
      mpn,
      `Title: ${title}\nSpecs: ${JSON.stringify(rawSpecs)}`,
    );
    if (specs) return specs;
  }

  if (category === "cpu_cooler" && mpn) {
    const specs = await cpuCoolerIAExtractor.extract(
      mpn,
      `Title: ${title}\nSpecs: ${JSON.stringify(rawSpecs)}`,
    );
    if (specs) return specs;
  }

  const processor = SPEC_PROCESSORS[category];
  if (!processor) return rawSpecs;

  return processor.normalize(rawSpecs, title);
}

// Extracción de marca
function extractBrandName(specs: Record<string, string>): string {
  return specs?.manufacturer || specs?.Fabricante || specs?.marca || specs?.brand || "Generic";
}

// Validación de producto (filtros específicos de PC Express)
interface ValidationRule {
  check: (title: string) => boolean;
  message: string;
}

const PC_EXPRESS_VALIDATION_RULES: Partial<Record<CategorySlug, ValidationRule[]>> = {
  motherboard: [
    {
      check: (title) => title.includes("PROCESADOR"),
      message: "Skipping miscategorized product (CPU in motherboard category)",
    },
  ],
  cpu: [
    {
      check: (title) => title.includes("PLACA MADRE"),
      message: "Skipping miscategorized product (motherboard in CPU category)",
    },
  ],
  psu: [
    {
      check: (title) => title.includes("MEMORIA"),
      message: "Skipping miscategorized product (memory in PSU category)",
    },
  ],
  case: [
    {
      check: (title) => !title.includes("GABINETE"),
      message: "Skipping non-case product in case category",
    },
  ],
  case_fan: [
    {
      check: (title) => {
        const hasVentilador = title.includes("VENTILADOR") || title.includes("VENTILADORES");
        const isExcluded =
          title.includes("SOPORTE") ||
          title.includes("COOLER CPU") ||
          title.includes("DISIPADOR") ||
          title.includes("WATER COOLING") ||
          title.includes("REFRIGERACION LIQUIDA") ||
          title.includes("AIO");
        return !hasVentilador || isExcluded;
      },
      message: "Skipping non-case-fan product",
    },
  ],
  cpu_cooler: [
    {
      check: (title) => {
        const isLiquidCooling =
          title.includes("REFRIGERACION LIQUIDA") ||
          title.includes("REGRIGERACION LIQUIDA") ||
          title.includes("WATERCOOLING") ||
          title.includes("WATER COOLING");
        const isAirCooler =
          title.includes("VENTILADOR PARA CPU") ||
          title.includes("VENTILADOR CPU") ||
          title.includes("COOLER CPU") ||
          title.includes("CPU COOLER");
        return !isLiquidCooling && !isAirCooler;
      },
      message: "Skipping non-cpu-cooler product",
    },
  ],
};

function validateProduct(
  product: ProductData,
  category: CategorySlug,
  crawlerType: CrawlerType,
): { valid: boolean; reason?: string } {
  // Global validation rules (apply to all crawlers)
  const titleUpper = product.title.toUpperCase();
  const invalidTerms = [
    "CAJA ABIERTA",
    "DAÑADA",
    "OPEN BOX",
    "SEGUNDA SELECCIÓN",
    "USADO",
    "REFURBISHED",
    "REACONDICIONADO",
    "SEMI NUEVO",
    "SEMINUEVO",
  ];

  for (const term of invalidTerms) {
    if (titleUpper.includes(term)) {
      return { valid: false, reason: `Skipping product with term: ${term}` };
    }
  }

  // Only apply validation rules for PC Express
  if (crawlerType !== "pc-express") {
    return { valid: true };
  }

  const rules = PC_EXPRESS_VALIDATION_RULES[category];
  if (!rules) return { valid: true };

  for (const rule of rules) {
    if (rule.check(titleUpper)) {
      return { valid: false, reason: rule.message };
    }
  }

  return { valid: true };
}

// Procesamiento de imágenes
async function processProductImage(
  mpn: string | undefined,
  imageUrl: string | undefined,
): Promise<string | null> {
  if (!imageUrl) return null;
  if (!mpn) return imageUrl;

  const result = await uploadProductImage(mpn, imageUrl);
  return result.success && result.url ? result.url : imageUrl;
}

// Procesamiento de producto individual
async function processProduct(
  product: ProductData,
  category: CategorySlug,
  categoryId: string,
  storeId: string,
  crawlerType: CrawlerType,
): Promise<ProcessingResult> {
  // Validar producto
  const validation = validateProduct(product, category, crawlerType);
  if (!validation.valid) {
    return { success: false, error: validation.reason };
  }

  // Extraer y resolver marca
  const rawSpecs = (product.specs as Record<string, string>) ?? {};
  const brandName = extractBrandName(rawSpecs);
  const brandId = await getOrCreateBrand(brandName);

  if (!brandId) {
    return { success: false, error: `Could not resolve brand: ${brandName}` };
  }

  // Normalizar especificaciones
  const normalizedSpecs = await normalizeSpecs(category, rawSpecs, product.title, product.mpn);

  // Revisar si existe producto por MPN
  let productId: string | null = null;
  if (product.mpn) {
    productId = await findExistingProduct(product.mpn);
  }

  // Procesar imagen
  const imageUrl = await processProductImage(product.mpn, product.imageUrl);

  // Crear producto si no existe
  if (!productId) {
    productId = await createProduct(
      product,
      category,
      categoryId,
      brandId,
      normalizedSpecs,
      imageUrl,
    );

    if (!productId) {
      return { success: false, error: "Failed to create product" };
    }
  } else {
    // Actualizar especificaciones de producto existente con las nuevas normalizadas (potencialmente mejoradas por IA)
    await updateProductSpecs(productId, normalizedSpecs);
  }

  // Insertar o actualizar listado
  const listingId = await upsertListing(product, productId, storeId);
  if (!listingId) {
    return { success: false, error: "Failed to upsert listing" };
  }

  // Registrar historial de precios
  await recordPriceHistory(listingId, product.price, product.originalPrice ?? product.price);

  return { success: true, productId, listingId };
}

// Procesamiento por lotes (Universal - funciona con cualquier crawler)
async function processBatch(
  crawler: BaseCrawler,
  urls: string[],
  category: CategorySlug,
  categoryId: string,
  storeId: string,
  crawlerType: CrawlerType,
): Promise<BatchResult[]> {
  // Obtener todo el HTML en paralelo usando el método batch del crawler
  const htmlResults = await crawler.fetchHtmlBatch(urls);

  // Procesar cada producto en paralelo
  const processPromises = urls.map(async (url): Promise<BatchResult> => {
    const html = htmlResults.get(url);
    if (!html) {
      return {
        url,
        result: { success: false, error: "Failed to fetch HTML" },
      };
    }

    try {
      const product = await crawler.parseProduct(html, url);
      if (!product) {
        return {
          url,
          result: { success: false, error: "Failed to parse product" },
        };
      }

      const result = await processProduct(product, category, categoryId, storeId, crawlerType);

      return { url, result };
    } catch (error) {
      return {
        url,
        result: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  return Promise.all(processPromises);
}

// Procesamiento de categoría
async function processCategory<T extends string>(
  crawler: BaseCrawler & {
    getAllProductUrlsForCategory: (cat: T) => Promise<string[]>;
  },
  category: T & CategorySlug,
  storeId: string,
  crawlerType: CrawlerType,
): Promise<number> {
  const startTime = Date.now();
  logger.info(`=== Processing ${crawlerType} category: ${category} ===`);

  // Obtener todas las URLs de productos
  const productUrls = await crawler.getAllProductUrlsForCategory(category);
  logger.info(`Found ${productUrls.length} product URLs for ${category}`);

  if (productUrls.length === 0) return 0;

  // Obtener o crear categoría en BD
  const categoryId = await getOrCreateCategory(category);
  if (!categoryId) {
    logger.error(`Could not resolve category: ${category}`);
    return 0;
  }

  // Procesar en lotes
  let processedCount = 0;
  const totalBatches = Math.ceil(productUrls.length / BATCH_SIZE);

  for (let i = 0; i < productUrls.length; i += BATCH_SIZE) {
    const batch = productUrls.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    logger.info(`[${category}] Batch ${batchNumber}/${totalBatches} (${batch.length} products)`);

    const results = await processBatch(crawler, batch, category, categoryId, storeId, crawlerType);

    const successCount = results.filter((r) => r.result.success).length;
    processedCount += successCount;

    // Registrar fallos para depuración
    for (const { url, result } of results) {
      if (!result.success && result.error) {
        logger.warn(`[${category}] ${result.error}: ${url.slice(-50)}`);
      }
    }

    logger.info(
      `[${category}] Batch ${batchNumber}: ${successCount}/${batch.length} | Total: ${processedCount}/${productUrls.length}`,
    );
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== ${category} completed: ${processedCount} products in ${duration}s ===`);

  return processedCount;
}

// Manejadores de trabajos
async function handlePcExpressJob(job: CollectorJobData): Promise<JobResult> {
  const startTime = Date.now();
  const crawler = new PcExpressCrawler();

  const storeId = await getStoreId("pc-express");
  if (!storeId) {
    throw new Error("Store 'pc-express' not found");
  }

  const categoriesToProcess: PcExpressCategory[] =
    job.category === "all" || !job.category
      ? (Object.keys(PC_EXPRESS_CATEGORIES) as PcExpressCategory[])
      : [job.category as PcExpressCategory];

  logger.info(`Categories: ${categoriesToProcess.join(", ")}`);

  const results: Record<string, number> = {};
  let totalProcessed = 0;

  for (const category of categoriesToProcess) {
    const count = await processCategory(crawler, category as CategorySlug, storeId, "pc-express");
    results[category] = count;
    totalProcessed += count;
  }

  const duration = (Date.now() - startTime) / 1000;
  logger.info(`Job completed: ${totalProcessed} products in ${duration.toFixed(1)}s`);

  return {
    status: "success",
    crawler: "pc-express",
    categories: categoriesToProcess,
    results,
    totalCount: totalProcessed,
    duration,
  };
}

async function handleSpDigitalJob(job: CollectorJobData): Promise<JobResult> {
  const startTime = Date.now();
  const crawler = new SpDigitalCrawler();

  const storeId = await getStoreId("sp-digital");
  if (!storeId) {
    throw new Error("Store 'sp-digital' not found");
  }

  const categoriesToProcess: SpDigitalCategory[] =
    job.category === "all" || !job.category
      ? (Object.keys(SP_DIGITAL_CATEGORIES) as SpDigitalCategory[])
      : [job.category as SpDigitalCategory];

  logger.info(`Categories: ${categoriesToProcess.join(", ")}`);

  const results: Record<string, number> = {};
  let totalProcessed = 0;

  try {
    for (const category of categoriesToProcess) {
      const count = await processCategory(crawler, category as CategorySlug, storeId, "sp-digital");
      results[category] = count;
      totalProcessed += count;
    }
  } finally {
    // Always close browser when done
    await crawler.closeBrowser();
  }

  const duration = (Date.now() - startTime) / 1000;
  logger.info(`Job completed: ${totalProcessed} products in ${duration.toFixed(1)}s`);

  return {
    status: "success",
    crawler: "sp-digital",
    categories: categoriesToProcess,
    results,
    totalCount: totalProcessed,
    duration,
  };
}

// Punto de entrada del Worker
self.onmessage = async (event: MessageEvent) => {
  const job = event.data as CollectorJobData;
  logger.info(`Processing job for ${job.crawler}`);

  try {
    let result: JobResult;

    switch (job.crawler) {
      case "pc-express":
        result = await handlePcExpressJob(job);
        break;
      case "sp-digital":
        result = await handleSpDigitalJob(job);
        break;
      default:
        throw new Error(`Unknown crawler: ${job.crawler}`);
    }

    postMessage(result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);

    logger.error(`Job failed`, errorMessage);
    postMessage({
      status: "error",
      crawler: job.crawler,
      error: errorMessage,
    });
  }
};
