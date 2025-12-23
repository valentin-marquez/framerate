import type { Json } from "@framerate/db";
import { ProductSpecsSchema } from "@framerate/db";
import { type ScrapedProduct, ScrapedProductSchema } from "@/collector/domain/schemas";
import type { CatalogService, CategorySlug } from "@/collector/services/catalog.service";
import { Logger } from "@/lib/logger";
import { uploadProductImage } from "@/lib/storage";
import {
  CaseFanProcessor,
  CaseProcessor,
  CpuCoolerProcessor,
  CpuProcessor,
  GpuProcessor,
  HddProcessor,
  MotherboardProcessor,
  PsuProcessor,
  RamProcessor,
  SsdProcessor,
} from "@/processors";
import { extractForCategory } from "@/processors/ai/base";
import type { CrawlerType } from "@/queues";

export interface PipelineContext {
  category: CategorySlug;
  storeId: string;
  crawlerType: CrawlerType;
}

export interface ProcessingResult {
  success: boolean;
  productId?: string | null;
  listingId?: string | null;
  error?: string;
}

const SPEC_PROCESSORS: Record<CategorySlug, { normalize: (s: Record<string, string>, t?: string) => unknown }> = {
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

function extractBrandName(specs: Record<string, string> | undefined): string {
  const s = specs ?? ({} as Record<string, string>);
  return s.manufacturer || s.Fabricante || s.marca || s.brand || "Generic";
}

export class ProductPipeline {
  private logger = new Logger("ProductPipeline");

  constructor(private catalogService: CatalogService) {}

  public getCatalogService(): CatalogService {
    return this.catalogService;
  }

  private iaTimeMs = 0;
  private iaCacheHits = 0;
  private iaLLMCalls = 0;

  public getIaTimeMs(): number {
    return this.iaTimeMs;
  }

  public getIaCacheHits(): number {
    return this.iaCacheHits;
  }

  public getIaLLMCalls(): number {
    return this.iaLLMCalls;
  }

  private async normalizeSpecs(
    category: CategorySlug,
    rawSpecs: Record<string, string>,
    title: string,
    mpn?: string | null,
    context?: unknown,
  ) {
    if (mpn) {
      try {
        const ctxPreview =
          context == null
            ? String(context)
            : typeof context === "string"
              ? context.slice(0, 200)
              : JSON.stringify(context).slice(0, 200);
        this.logger.info(
          `IA request: mpn=${mpn} category=${category} contextType=${context == null ? "null" : typeof context} ctxPreview=${ctxPreview}`,
        );
      } catch (_e) {
        // ignore preview errors
      }

      const specs = await extractForCategory(
        category,
        mpn,
        `Title: ${title}\nSpecs: ${JSON.stringify(rawSpecs)}`,
        context,
      );
      if (specs) return specs;
    }

    const processor = SPEC_PROCESSORS[category];
    if (!processor) return rawSpecs;

    return processor.normalize(rawSpecs, title);
  }

  private validateProduct(
    product: { title?: string },
    category: CategorySlug,
    crawlerType: CrawlerType,
  ): { valid: boolean; reason?: string } {
    const titleUpper = (product.title ?? "").toUpperCase();
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
      if (titleUpper.includes(term)) return { valid: false, reason: `Skipping product with term: ${term}` };
    }

    if (crawlerType !== "pc-express") return { valid: true };

    const PC_EXPRESS_VALIDATION_RULES: Partial<
      Record<CategorySlug, Array<{ check: (title: string) => boolean; message: string }>>
    > = {
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

    const rules = PC_EXPRESS_VALIDATION_RULES[category];
    if (!rules) return { valid: true };

    for (const rule of rules) {
      if (rule.check(titleUpper)) return { valid: false, reason: rule.message };
    }

    return { valid: true };
  }

  public async process(input: unknown, ctx: PipelineContext): Promise<ProcessingResult> {
    // 1) Validate + coerce input using Zod
    const parse = ScrapedProductSchema.safeParse(input);
    if (!parse.success) {
      const errorMsg = parse.error.issues
        .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
        .join(", ");
      return { success: false, error: `Validation Failed: ${errorMsg}` };
    }

    const raw: ScrapedProduct = parse.data;

    // validation
    const validation = this.validateProduct({ title: raw.title }, ctx.category, ctx.crawlerType);
    if (!validation.valid) return { success: false, error: validation.reason };

    const rawSpecs = (raw.specs as Record<string, string>) ?? {};
    const brandName = extractBrandName(rawSpecs);

    const brandId = await this.catalogService.resolveBrandId(brandName);
    if (!brandId) return { success: false, error: `Could not resolve brand: ${brandName}` };

    // normalize specs
    const normalizedSpecs = await this.normalizeSpecs(ctx.category, rawSpecs, raw.title ?? "", raw.mpn, raw.context);

    // Validate normalized specs against DB schemas (ProductSpecsSchema union)
    if (normalizedSpecs && typeof normalizedSpecs === "object") {
      const v = ProductSpecsSchema.safeParse(normalizedSpecs);
      if (!v.success) {
        // Log a warning but continue with the original normalized value
        const issues = v.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`).join(", ");
        this.logger.warn(`Specs validation failed for category=${ctx.category}: ${issues}`);
      }
    } else {
      // If normalized specs are not an object, warn
      if (normalizedSpecs != null) this.logger.warn(`Normalized specs for ${ctx.category} are not an object`);
    }

    // process image
    let imageUrl: string | null = raw.imageUrl ?? null;
    if (imageUrl && raw.mpn) {
      try {
        const uploaded = await uploadProductImage(raw.mpn, imageUrl);
        if (uploaded.success && uploaded.url) imageUrl = uploaded.url;
      } catch (err) {
        this.logger.warn("Image upload failed", (err as Error).message || String(err));
      }
    }

    // persist
    const categoryId = await this.catalogService.getCategoryId(ctx.category);
    if (!categoryId) return { success: false, error: `Could not resolve category: ${ctx.category}` };

    const { productId, listingId } = await this.catalogService.upsertProductAndListing(
      {
        title: raw.title,
        mpn: raw.mpn ?? null,
        specs: normalizedSpecs as unknown as Json,
        brandId,
        categoryId,
        imageUrl,
      },
      {
        url: raw.url,
        price: raw.price ?? null,
        originalPrice: raw.originalPrice ?? raw.price ?? null,
        stock: raw.stock ?? null,
        stockQuantity: raw.stockQuantity ?? null,
        storeId: ctx.storeId,
      },
      { pending: true }, // Mark as pending so Cortex can review and activate once specs are generated
    );

    if (!productId || !listingId) return { success: false, error: "Failed to persist product/listing" };

    return { success: true, productId, listingId };
  }
}
