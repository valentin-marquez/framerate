import { ProductSpecsSchema, toJson } from "@framerate/db";
import { type ScrapedProduct, ScrapedProductSchema } from "@/collector/domain/schemas";
import type { BrandService } from "@/collector/services/brand.service";
import type { CatalogService, CategorySlug } from "@/collector/services/catalog.service";
import { Logger } from "@/lib/logger";
import { uploadProductImage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { type ExtractionContext, extractForCategory } from "@/processors/ai/base";
import { normalizeTitle } from "@/processors/normalizers";
import type { CrawlerType } from "@/queues";

export interface PipelineContext {
  category: CategorySlug;
  storeId: string;
  crawlerType: CrawlerType;
}

export interface ReconcileGpuTitleResult {
  title: string;
  corrected: boolean;
  titleGb?: number;
  specsGb?: number;
}

/**
 * Defense-in-depth reconciliation between the SEO title produced by the
 * per-category normalizer (heuristic regex) and the authoritative specs
 * returned by the LLM extraction pipeline.
 *
 * Policy: when the title claims a GB value for VRAM that disagrees with
 * `specs.memory_gb`, we trust the LLM specs and rewrite the title.
 *
 * Notes:
 * - We only rewrite an EXISTING wrong "<n>GB" token. We do NOT inject a GB
 *   token into a title that lacks one — bracketed MPN suffixes such as
 *   `[DUAL-RTX5070-O12G]` legitimately omit the standalone GB phrase, and
 *   inserting one risks corrupting otherwise-clean titles.
 * - When several "<n>GB" tokens are present we pick the one closest to the
 *   end of the title (excluding any bracketed suffix), because AIB titles
 *   conventionally place the VRAM right before the SKU suffix
 *   (e.g., "... 12GB OC [DUAL-RTX5070-O12G]"). Bracketed suffixes are
 *   preserved verbatim.
 *
 * TODO: extend reconciliation to other categories. Likely candidates:
 *   - ssd.capacity_gb ↔ title GB/TB
 *   - ram.modules[*].capacity_gb ↔ title GB
 *   - psu.wattage ↔ title W
 */
export function reconcileGpuTitle(seoTitle: string, specs: unknown): ReconcileGpuTitleResult {
  if (!specs || typeof specs !== "object") {
    return { title: seoTitle, corrected: false };
  }

  const specsGbRaw = (specs as Record<string, unknown>).memory_gb;
  const specsGb = typeof specsGbRaw === "number" && Number.isFinite(specsGbRaw) ? specsGbRaw : undefined;
  if (specsGb === undefined || specsGb <= 0) {
    return { title: seoTitle, corrected: false };
  }

  // Split off a trailing bracketed suffix (typically `[MPN]`) so we never
  // touch its contents — MPN strings frequently embed digits like `O12G`
  // that look like memory tokens but are SKU codes.
  const suffixMatch = seoTitle.match(/\s*\[[^\]]+\]\s*$/);
  const suffix = suffixMatch ? suffixMatch[0] : "";
  const body = suffix ? seoTitle.slice(0, seoTitle.length - suffix.length) : seoTitle;

  const gbRegex = /\b(\d+)\s*GB\b/gi;
  const matches = [...body.matchAll(gbRegex)];
  if (matches.length === 0) {
    return { title: seoTitle, corrected: false };
  }

  // Prefer the GB token closest to the end of the body — that's where AIB
  // titles place the VRAM (e.g., "... 12GB OC").
  const last = matches[matches.length - 1];
  if (!last || last.index === undefined) {
    return { title: seoTitle, corrected: false };
  }

  const titleGb = Number.parseInt(last[1] ?? "", 10);
  if (!Number.isFinite(titleGb) || titleGb === specsGb) {
    return { title: seoTitle, corrected: false, titleGb, specsGb };
  }

  const start = last.index;
  const end = start + last[0].length;
  const newBody = `${body.slice(0, start)}${specsGb}GB${body.slice(end)}`;
  const newTitle = `${newBody}${suffix}`;

  return { title: newTitle, corrected: true, titleGb, specsGb };
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
    invalidTerms: ["CARCASA", "PLATAFORMA GIRATORIA"],
  },
  ssd: {
    invalidTerms: ["SOPORTE", "ADAPTADOR", "CARCASA", "MICROSD", "PENDRIVE"],
  },
  hdd: {
    invalidTerms: ["SOPORTE", "ADAPTADOR", "CARCASA", "MICROSD", "PENDRIVE"],
  },
  ram: {
    excludeIfContains: ["SOPORTE", "DISIPADOR SOLO"],
  },
  case_fan: {
    excludeIfContains: ["PASTA TERMICA", "PASTA TÉRMICA", "HUB"],
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
    excludeIfContains: ["ADAPTADOR", "PASTA TERMICA", "PASTA TÉRMICA", "HUB"],
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
    context?: ExtractionContext,
    options?: { normalizedTitle?: string; brand?: string; url?: string },
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
        options,
      );
      if (specs) return specs;
    }

    // Fallback: if no MPN or AI extraction skipped/failed, return null to avoid dirty data.
    return null;
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

    // [NEW] Ingest into Raw Feed (Phase 1/3: Parallel Ingestion)
    try {
      await supabase.from("raw_feed").insert({
        source: ctx.crawlerType,
        external_id: raw.url, // URL as unique ID for now
        payload: toJson(raw),
        processing_status: "NEW",
        ingested_at: new Date().toISOString(),
      });
      this.logger.info(`Ingested into raw_feed: ${raw.title}`);
    } catch (err) {
      this.logger.error("Failed to insert into raw_feed", (err as Error).message);
      // Don't fail the whole pipeline for now, just log
    }

    const rawSpecs = (raw.specs as Record<string, string>) ?? {};
    const brandName = await this.brandService.extractBrand(raw.title ?? "", rawSpecs);

    // Título SEO normalizado por categoría. Antes se eliminaba el MPN del cuerpo y se
    // re-añadía al final entre corchetes; eso destrozaba títulos donde el MPN ES el modelo
    // (placas madre, GPUs sin sufijo) y reducía el título a "Marca [MPN]" — generando
    // colisiones masivas en `findSimilarProduct` (e.g., todos los Gigabyte mergeados juntos).
    // Ahora dejamos el título normalizado tal cual, y sólo agregamos `[MPN]` si el MPN no
    // aparece ya en él (con normalización agnóstica a punctuation/casing).
    let seoTitle = normalizeTitle(raw.title ?? "", ctx.category, raw.mpn ?? undefined, brandName)
      .replace(/\s{2,}/g, " ")
      .replace(/[-–",]+$/, "")
      .trim();

    if (raw.mpn) {
      const cleanMpn = raw.mpn.trim();
      const titleKey = seoTitle.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const mpnKey = cleanMpn.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (mpnKey && !titleKey.includes(mpnKey)) {
        seoTitle = `${seoTitle} [${cleanMpn}]`;
      }
    }

    const brandId = await this.catalogService.resolveBrandId(brandName);
    if (!brandId) return { success: false, error: `Could not resolve brand: ${brandName}` };

    const normalizedSpecs = await this.normalizeSpecs(ctx.category, rawSpecs, raw.title ?? "", raw.mpn, raw.context, {
      normalizedTitle: seoTitle,
      brand: brandName,
      url: raw.url,
    });

    if (normalizedSpecs && typeof normalizedSpecs === "object") {
      const v = ProductSpecsSchema.safeParse(normalizedSpecs);
      if (!v.success) {
        const issues = v.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`).join(", ");
        this.logger.warn(`Specs validation failed for category=${ctx.category}: ${issues}`);
      }
    } else {
      if (normalizedSpecs != null) this.logger.warn(`Normalized specs for ${ctx.category} are not an object`);
    }

    // Defense-in-depth: reconcile the seoTitle against the LLM specs so a
    // buggy normalizer regex can't bake the wrong VRAM into the public slug.
    // TODO: extend reconciliation to other categories (ssd.capacity_gb,
    // ram.modules.capacity_gb, psu.wattage, ...).
    if (ctx.category === "gpu" && normalizedSpecs && typeof normalizedSpecs === "object") {
      const reconciled = reconcileGpuTitle(seoTitle, normalizedSpecs);
      if (reconciled.corrected) {
        this.logger.warn("title_specs_mismatch", {
          event: "title_specs_mismatch",
          category: ctx.category,
          mpn: raw.mpn ?? null,
          seoTitle,
          title_gb: reconciled.titleGb,
          specs_gb: reconciled.specsGb,
          source: ctx.crawlerType,
        });
        seoTitle = reconciled.title;
      }
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
      toJson(normalizedSpecs),
    );

    // If we found a similar product, use its MPN and merge specs if needed
    let finalMpn = raw.mpn ?? null;
    let finalSpecs = toJson(normalizedSpecs);

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
            finalSpecs = toJson(reNormalizedSpecs);
            this.logger.info(`Re-normalized specs with found MPN`);
          }
        }
      }

      // Merge specs: prefer new specs but keep existing ones if missing
      if (similarProduct.specs && typeof similarProduct.specs === "object") {
        const existingSpecs = similarProduct.specs as Record<string, unknown>;
        const newSpecs = (finalSpecs as Record<string, unknown>) || {};

        // Merge: new specs take precedence, but preserve existing if not present
        finalSpecs = toJson({
          ...existingSpecs,
          ...newSpecs,
        });
      }
    }

    // Solo marcar como pending si es un producto completamente nuevo (sin match en BD).
    // Si ya existe (similarProduct), el producto ya fue validado — activar según precio/stock.
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
      { pending: !similarProduct },
    );

    if (!productId || !listingId) return { success: false, error: "Failed to persist product/listing" };

    return { success: true, productId, listingId };
  }
}
