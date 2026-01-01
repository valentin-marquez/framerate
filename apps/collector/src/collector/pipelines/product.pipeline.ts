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
import { normalizeTitle } from "@/processors/normalizers";
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

const GLOBAL_INVALID_TERMS = [
  "CAJA ABIERTA",
  "DAÑADA",
  "OPEN BOX",
  "SEGUNDA SELECCIÓN",
  "USADO",
  "REFURBISHED",
  "REACONDICIONADO",
  "SEMI NUEVO",
  "SEMINUEVO",
  "LICENCIA",
  "THERMAL PAD",
  "PASTA DISIPADORA",
  "KIT PARA SOCKET",
  "KIT PARA",
  "KIT DE MONTAJE",
  "BASE PARA SILLA",
];

interface CategoryValidationRule {
  invalidTerms?: string[];
  requiredTerms?: string[];
  excludeIfContains?: string[];
  customCheck?: (title: string) => { valid: boolean; reason?: string };
}

const CATEGORY_VALIDATION_RULES: Partial<Record<CategorySlug, CategoryValidationRule>> = {
  motherboard: {
    excludeIfContains: ["PROCESADOR"],
  },
  cpu: {
    excludeIfContains: ["PLACA MADRE", "CONTROLADOR", "CONTROL DE LUCES", "ARGB CONTROLLER", "RGB CONTROLLER"],
  },
  psu: {
    excludeIfContains: ["MEMORIA RAM", "CONTROLADOR", "CONTROLADOR DE LUCES"],
  },
  case: {
    requiredTerms: ["GABINETE"],
    invalidTerms: ["CARCASA"],
  },
  ssd: {
    invalidTerms: ["SOPORTE", "ADAPTADOR", "CARCASA"],
  },
  hdd: {
    invalidTerms: ["SOPORTE", "ADAPTADOR", "CARCASA"],
  },
  ram: {
    excludeIfContains: ["SOPORTE", "DISIPADOR SOLO"],
  },
  case_fan: {
    customCheck: (title: string) => {
      const hasVentilador = title.includes("VENTILADOR") || title.includes("VENTILADORES");
      const isExcluded =
        title.includes("SOPORTE") ||
        title.includes("COOLER CPU") ||
        title.includes("DISIPADOR") ||
        title.includes("WATER COOLING") ||
        title.includes("REFRIGERACION LIQUIDA") ||
        title.includes("REFRIGERACIÓN LÍQUIDA") ||
        title.includes("AIO");

      if (!hasVentilador) return { valid: false, reason: "Case fan must contain 'VENTILADOR'" };
      if (isExcluded) return { valid: false, reason: "Product is excluded (CPU cooler, support, etc.)" };
      return { valid: true };
    },
  },
  cpu_cooler: {
    excludeIfContains: ["ADAPTADOR"],
    customCheck: (title: string) => {
      const isLiquidCooling =
        title.includes("REFRIGERACION LIQUIDA") ||
        title.includes("REFRIGERACIÓN LÍQUIDA") ||
        title.includes("REGRIGERACION LIQUIDA") ||
        title.includes("WATERCOOLING") ||
        title.includes("WATER COOLING") ||
        title.includes("AIO");

      const isAirCooler =
        title.includes("VENTILADOR PARA CPU") ||
        title.includes("VENTILADOR CPU") ||
        title.includes("COOLER CPU") ||
        title.includes("CPU COOLER") ||
        title.includes("DISIPADOR CPU");

      if (!isLiquidCooling && !isAirCooler) {
        return { valid: false, reason: "Product is not a CPU cooler" };
      }
      return { valid: true };
    },
  },
};

function extractBrandName(specs: Record<string, string> | undefined): string {
  const s = specs ?? ({} as Record<string, string>);
  return s.manufacturer || s.Fabricante || s.marca || s.brand || "Generic";
}

export class ProductPipeline {
  private logger = new Logger("ProductPipeline");
  private iaTimeMs = 0;
  private iaCacheHits = 0;
  private iaLLMCalls = 0;

  constructor(private catalogService: CatalogService) {}

  public getCatalogService(): CatalogService {
    return this.catalogService;
  }

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
      } catch (_e) {}

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

  private validateProduct(product: { title?: string }, category: CategorySlug): { valid: boolean; reason?: string } {
    const title = product.title ?? "";
    const titleUpper = title.toUpperCase();

    for (const term of GLOBAL_INVALID_TERMS) {
      if (titleUpper.includes(term)) {
        return { valid: false, reason: `Contains invalid term: ${term}` };
      }
    }

    const categoryRule = CATEGORY_VALIDATION_RULES[category];
    if (!categoryRule) return { valid: true };

    if (categoryRule.invalidTerms) {
      for (const term of categoryRule.invalidTerms) {
        if (titleUpper.includes(term)) {
          return { valid: false, reason: `Category ${category}: contains invalid term '${term}'` };
        }
      }
    }

    if (categoryRule.requiredTerms) {
      const hasRequired = categoryRule.requiredTerms.some((term) => titleUpper.includes(term));
      if (!hasRequired) {
        return {
          valid: false,
          reason: `Category ${category}: missing required terms (${categoryRule.requiredTerms.join(", ")})`,
        };
      }
    }

    if (categoryRule.excludeIfContains) {
      for (const term of categoryRule.excludeIfContains) {
        if (titleUpper.includes(term)) {
          return { valid: false, reason: `Category ${category}: miscategorized product (contains '${term}')` };
        }
      }
    }

    if (categoryRule.customCheck) {
      return categoryRule.customCheck(titleUpper);
    }

    return { valid: true };
  }

  public async process(input: unknown, ctx: PipelineContext): Promise<ProcessingResult> {
    const parse = ScrapedProductSchema.safeParse(input);
    if (!parse.success) {
      const errorMsg = parse.error.issues
        .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
        .join(", ");
      return { success: false, error: `Validation Failed: ${errorMsg}` };
    }

    const raw: ScrapedProduct = parse.data;

    const validation = this.validateProduct({ title: raw.title }, ctx.category);
    if (!validation.valid) {
      this.logger.info(`Product rejected: ${validation.reason}`, { title: raw.title, category: ctx.category });
      return { success: false, error: validation.reason };
    }

    const rawSpecs = (raw.specs as Record<string, string>) ?? {};
    const brandName = extractBrandName(rawSpecs);

    const brandId = await this.catalogService.resolveBrandId(brandName);
    if (!brandId) return { success: false, error: `Could not resolve brand: ${brandName}` };

    const normalizedSpecs = await this.normalizeSpecs(ctx.category, rawSpecs, raw.title ?? "", raw.mpn, raw.context);

    if (normalizedSpecs && typeof normalizedSpecs === "object") {
      const v = ProductSpecsSchema.safeParse(normalizedSpecs);
      if (!v.success) {
        const issues = v.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`).join(", ");
        this.logger.warn(`Specs validation failed for category=${ctx.category}: ${issues}`);
      }
    } else {
      if (normalizedSpecs != null) this.logger.warn(`Normalized specs for ${ctx.category} are not an object`);
    }

    let seoTitle = normalizeTitle(raw.title ?? "", ctx.category, raw.mpn ?? undefined, brandName);

    if (raw.mpn) {
      const cleanMpn = raw.mpn.trim();
      const escapedMpn = cleanMpn.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const mpnRegex = new RegExp(escapedMpn, "gi");

      seoTitle = seoTitle.replace(mpnRegex, "").trim();
      seoTitle = seoTitle
        .replace(/\s{2,}/g, " ")
        .replace(/[-–",]+$/, "")
        .trim();

      seoTitle = `${seoTitle} [${cleanMpn}]`;
    }

    let imageUrl: string | null = raw.imageUrl ?? null;
    if (imageUrl && raw.mpn) {
      try {
        const uploaded = await uploadProductImage(raw.mpn, imageUrl);
        if (uploaded.success && uploaded.url) imageUrl = uploaded.url;
      } catch (err) {
        this.logger.warn("Image upload failed", (err as Error).message || String(err));
      }
    }

    const categoryId = await this.catalogService.getCategoryId(ctx.category);
    if (!categoryId) return { success: false, error: `Could not resolve category: ${ctx.category}` };

    const { productId, listingId } = await this.catalogService.upsertProductAndListing(
      {
        title: seoTitle,
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
      { pending: true },
    );

    if (!productId || !listingId) return { success: false, error: "Failed to persist product/listing" };

    return { success: true, productId, listingId };
  }
}
