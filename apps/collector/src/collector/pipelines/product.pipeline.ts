import type { Json } from "@framerate/db";
import { ProductSpecsSchema } from "@framerate/db";
import { type ScrapedProduct, ScrapedProductSchema } from "@/collector/domain/schemas";
import type { BrandService } from "@/collector/services/brand.service";
import type { CatalogService, CategorySlug } from "@/collector/services/catalog.service";
import { Logger } from "@/lib/logger";
import { uploadProductImage } from "@/lib/storage";
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
  gpu: {
    excludeIfContains: ["SOPORTE"],
  },
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

export class ProductPipeline {
  private logger = new Logger("ProductPipeline");
  private iaTimeMs = 0;
  private iaCacheHits = 0;
  private iaLLMCalls = 0;

  constructor(
    private catalogService: CatalogService,
    private brandService: BrandService,
  ) {}

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

    // Fallback: if no MPN or AI extraction skipped/failed, return raw specs
    // Since we removed traditional processors, we just return what we have.
    // This might mean specs are not normalized until AI processes them later (if MPN is found later).
    return rawSpecs;
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
    const brandName = await this.brandService.extractBrand(raw.title ?? "", rawSpecs);

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

    // Search for similar products before creating a new one
    const similarProduct = await this.catalogService.findSimilarProduct(
      raw.title ?? "",
      categoryId,
      brandId,
      raw.mpn,
      normalizedSpecs as unknown as Json,
    );

    // If we found a similar product, use its MPN and merge specs if needed
    let finalMpn = raw.mpn ?? null;
    let finalSpecs = normalizedSpecs as unknown as Json;

    if (similarProduct) {
      this.logger.info(`Found similar product: ${similarProduct.id}, enriching data`, {
        scrapedMpn: raw.mpn,
        existingMpn: similarProduct.mpn,
        hasExistingSpecs: !!similarProduct.specs,
      });

      // Use existing MPN if we don't have one
      if (!finalMpn && similarProduct.mpn) {
        finalMpn = similarProduct.mpn;
        this.logger.info(`Using MPN from similar product: ${finalMpn}`);

        // Re-normalize with the found MPN if we didn't have one before
        if (!raw.mpn && finalMpn) {
          const reNormalizedSpecs = await this.normalizeSpecs(
            ctx.category,
            rawSpecs,
            raw.title ?? "",
            finalMpn,
            raw.context,
          );
          if (reNormalizedSpecs) {
            finalSpecs = reNormalizedSpecs as unknown as Json;
            this.logger.info(`Re-normalized specs with found MPN`);
          }
        }
      }

      // Merge specs: prefer new specs but keep existing ones if missing
      if (similarProduct.specs && typeof similarProduct.specs === "object") {
        const existingSpecs = similarProduct.specs as Record<string, unknown>;
        const newSpecs = (finalSpecs as Record<string, unknown>) || {};

        // Merge: new specs take precedence, but preserve existing if not present
        finalSpecs = {
          ...existingSpecs,
          ...newSpecs,
        } as unknown as Json;
      }
    }

    const { productId, listingId } = await this.catalogService.upsertProductAndListing(
      {
        title: seoTitle,
        mpn: finalMpn,
        specs: finalSpecs,
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
