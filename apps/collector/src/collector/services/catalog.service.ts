import type { Json, TablesInsert } from "@framerate/db";
import { Logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

export type CategorySlug =
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

export interface UpsertResult {
  productId: string | null;
  listingId: string | null;
}

/**
 * Clave de comparación de MPN: uppercase + sólo alfanumérico.
 * Distintas tiendas escriben el mismo MPN con espacios, guiones o casing distintos
 * (e.g., "B850M D3HP" / "B850M-D3HP" / "b850m d3hp"). Para deduplicar productos del mismo
 * fabricante hay que comparar por esta forma normalizada.
 */
export function normalizeMpnKey(mpn: string | null | undefined): string {
  return (mpn ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Extrae el primer token "<digits>GB" del nombre del producto.
 * Devuelve el número (e.g., 12) o null si no hay match.
 * El nombre típicamente tiene la forma:
 *   "ASUS Dual RTX 5070 12GB OC [DUAL-RTX5070-O12G]"
 *   "MSI Ventus 3X OC RTX 5070 70GB" (bug case: nombre incorrecto)
 *
 * Solo capturamos el primer token fuera de los corchetes del MPN.
 */
function extractGbFromName(name: string | null | undefined): number | null {
  if (!name) return null;
  // Strip bracketed MPN suffix to evitar capturar el MPN como "12G"
  const stripped = name.replace(/\s*\[.*?\]\s*$/, "");
  const m = stripped.match(/\b(\d{1,4})\s*GB\b/i);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Intenta inferir la capacidad (GB) implícita en un MPN.
 * Patrones comunes en GPUs:
 *   - DUAL-RTX5070-O12G  → 12
 *   - RTX5060-O8G        → 8
 *   - GV-N4060OC-8GD     → 8
 *   - VCG507012DFXPB1    → ambiguo, no debería matchear
 *
 * Estrategia: primero buscar capacidad con prefijo "O" o "-" (más confiable),
 * luego fallback al sufijo "<digits>G" o "<digits>GB".
 * Solo devolvemos valores en un rango razonable (1..128 GB) para evitar
 * matchear cosas tipo "5070" como "070G".
 */
function extractGbHintFromMpn(mpn: string | null | undefined): number | null {
  if (!mpn) return null;
  const upper = mpn.toUpperCase();

  // 1) Prefijo "O" o "-" seguido de dígitos + G (más confiable)
  //    Matchea "-O12G", "-O8G", "-12G", " O8G ".
  const prefixed = upper.match(/(?:^|[^A-Z0-9])(?:O|-)(\d{1,3})G(?![A-Z0-9])/);
  if (prefixed) {
    const n = Number.parseInt(prefixed[1], 10);
    if (Number.isFinite(n) && n >= 1 && n <= 128) return n;
  }

  // 2) Sufijo terminando en "<digits>G" o "<digits>GB"
  const suffix = upper.match(/(\d{1,3})\s*GB?$/);
  if (suffix) {
    const n = Number.parseInt(suffix[1], 10);
    if (Number.isFinite(n) && n >= 1 && n <= 128) return n;
  }

  // 3) "GD" sufijo (Gigabyte-style: "8GD6", "12GD7") — capturar dígitos antes
  const gigabyte = upper.match(/(\d{1,3})GD\d?/);
  if (gigabyte) {
    const n = Number.parseInt(gigabyte[1], 10);
    if (Number.isFinite(n) && n >= 1 && n <= 128) return n;
  }

  return null;
}

/**
 * Genera el slug base a partir de un nombre de producto. No incluye sufijo único.
 */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Decide si conviene reemplazar el nombre persistido por uno nuevo cuando se mergea
 * un listing bajo un producto existente. La motivación es corregir capacidades VRAM
 * mal extraídas históricamente (bug en `processors/normalizers/gpu.ts`) sin reescribir
 * datos en masa.
 *
 * Reglas:
 *   1. Si MPN sugiere capacidad (e.g., "DUAL-RTX5070-O12G" → 12), preferir el nombre
 *      cuya capacidad GB coincide con la del MPN. Si ninguno coincide, mantener existente.
 *   2. Si MPN no da pista y los GB difieren, mantener existente (conservador, no churn).
 *   3. Si ambos coinciden o no hay GB en ninguno, mantener existente (no-op).
 */
export function pickBetterName({
  existingName,
  newName,
  mpn,
}: {
  existingName: string;
  newName: string;
  mpn: string | null | undefined;
}): { name: string; renamed: boolean; reason: string } {
  const existingGb = extractGbFromName(existingName);
  const newGb = extractGbFromName(newName);
  const mpnHint = extractGbHintFromMpn(mpn);

  // Same GB → keep existing (no-op).
  if (existingGb === newGb) {
    return { name: existingName, renamed: false, reason: "same_gb_or_no_gb" };
  }

  if (mpnHint != null) {
    // Caso ideal: una de las dos coincide con el MPN.
    if (existingGb === mpnHint && newGb !== mpnHint) {
      return { name: existingName, renamed: false, reason: "existing_matches_mpn" };
    }
    if (newGb === mpnHint && existingGb !== mpnHint) {
      return {
        name: newName,
        renamed: true,
        reason: `new_matches_mpn_hint_${mpnHint}gb_existing_was_${existingGb ?? "none"}gb`,
      };
    }
    // Ninguno coincide con la pista del MPN: no churn.
    return {
      name: existingName,
      renamed: false,
      reason: `mpn_hint_${mpnHint}gb_no_name_matches`,
    };
  }

  // Sin pista de MPN: conservador. Mantener existente.
  return {
    name: existingName,
    renamed: false,
    reason: `no_mpn_hint_gb_differs_existing_${existingGb ?? "none"}_new_${newGb ?? "none"}`,
  };
}

export class CatalogService {
  private logger = new Logger("CatalogService");
  private brandCache = new Map<string, string>();
  private brandPendingPromises = new Map<string, Promise<string | null>>();

  private CATEGORY_CONFIG: Record<CategorySlug, { slug: CategorySlug; name: string }> = {
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

  async getCategoryId(slug: CategorySlug): Promise<string | null> {
    const config = this.CATEGORY_CONFIG[slug];

    const { data: existing, error: selError } = await supabase
      .from("categories")
      .select("id")
      .eq("code", config.slug)
      .single();

    if (selError) this.logger.error("getCategoryId: select error", selError.message || String(selError));

    if (existing) return existing.id;

    const insert: TablesInsert<"categories"> = {
      name: config.name,
      slug: config.slug,
      code: config.slug,
    };

    const { data: created, error } = await supabase.from("categories").insert(insert).select("id").single();

    if (error) {
      const code = (error as { code?: unknown }).code as string | undefined;
      if (code === "23505") {
        const { data: retryExisting } = await supabase.from("categories").select("id").eq("code", config.slug).single();
        if (retryExisting) return retryExisting.id;
      }

      const msg = (error as { message?: unknown }).message as string | undefined;
      this.logger.error(`Failed to create category ${slug}`, msg ?? String(error));
      return null;
    }

    return created?.id ?? null;
  }

  private async getOrCreateBrandInternal(normalizedName: string, slug: string): Promise<string | null> {
    const { data: existing } = await supabase.from("brands").select("id").eq("slug", slug).single();

    if (existing) {
      this.brandCache.set(slug, existing.id);
      return existing.id;
    }

    const insert: TablesInsert<"brands"> = {
      name: normalizedName,
      slug,
    };

    const { data: created, error } = await supabase.from("brands").insert(insert).select("id").single();

    if (error) {
      const code = (error as { code?: unknown }).code as string | undefined;
      if (code === "23505") {
        await new Promise((r) => setTimeout(r, 100));
        const { data: retryExisting } = await supabase.from("brands").select("id").eq("slug", slug).single();
        if (retryExisting) {
          this.brandCache.set(slug, retryExisting.id);
          return retryExisting.id;
        }
      }
      const msg = (error as { message?: unknown }).message as string | undefined;
      this.logger.error(`Failed to create brand ${normalizedName}`, msg ?? String(error));
      return null;
    }

    if (created?.id) this.brandCache.set(slug, created.id);

    return created?.id ?? null;
  }

  async resolveBrandId(brandName: string): Promise<string | null> {
    const normalizedName = (brandName || "").trim() || "Generic";
    const slug = normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const cached = this.brandCache.get(slug);
    if (cached) return cached;

    const pending = this.brandPendingPromises.get(slug);
    if (pending) return pending;

    const promise = this.getOrCreateBrandInternal(normalizedName, slug);
    this.brandPendingPromises.set(slug, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.brandPendingPromises.delete(slug);
    }
  }

  async getStoreId(slug: string): Promise<string | null> {
    const { data, error } = await supabase.from("stores").select("id").eq("slug", slug).single();

    if (error || !data) {
      this.logger.error(`Store '${slug}' not found in DB`);
      return null;
    }

    return data.id;
  }

  /**
   * Busca un producto existente por MPN, comparando ambos lados normalizados
   * (uppercase + sólo alfanumérico) para tolerar variaciones de espacios/guiones/casing.
   *
   * Acotamos por `categoryId` (mismo MPN puede existir en categorías distintas en errores
   * de captura). Trae los candidatos de la categoría y filtra en JS — cada categoría tiene
   * ~cientos de filas, así que el costo es despreciable y evita una RPC custom.
   */
  async findExistingProductByMpn(mpn: string, categoryId?: string): Promise<string | null> {
    const key = normalizeMpnKey(mpn);
    if (!key) return null;

    let query = supabase.from("products").select("id, mpn").not("mpn", "is", null);
    if (categoryId) query = query.eq("category_id", categoryId);

    const { data } = await query.limit(2000);
    if (!data) return null;

    const match = data.find((row) => normalizeMpnKey(row.mpn) === key);
    return match?.id ?? null;
  }

  /**
   * Search for similar products in the database using multiple criteria:
   * 1. Exact MPN match (highest priority)
   * 2. Title similarity with same category and brand
   * 3. Key specs match (for products without MPN)
   *
   * Returns the product data if found, including its specs and MPN
   */
  async findSimilarProduct(
    title: string,
    categoryId: string,
    brandId: string,
    mpn?: string | null,
    specs?: Json,
  ): Promise<{ id: string; mpn: string | null; specs: Json | null } | null> {
    try {
      // 1. PRIORITY: MPN normalizado (= UNIQUE INDEX en DB).
      //    Tolera "B850M D3HP" vs "B850M-D3HP" / "b850m d3hp".
      if (mpn) {
        const key = normalizeMpnKey(mpn);
        if (key) {
          const { data: candidates } = await supabase
            .from("products")
            .select("id, mpn, specs")
            .eq("category_id", categoryId)
            .not("mpn", "is", null)
            .limit(2000);

          const match = candidates?.find((row) => normalizeMpnKey(row.mpn) === key);
          if (match) {
            this.logger.info(`Found existing product by normalized MPN: ${mpn} → ${match.mpn}`);
            return match;
          }
        }
      }

      // 2. Fallback: match por título normalizado SOLO si tenemos un baseName lo bastante
      //    específico (>= 3 caracteres significativos además del brand+form factor) Y los
      //    MPNs no son claramente diferentes. Antes esto matcheaba "Gigabyte [%]" con
      //    cualquier mobo Gigabyte y producía 193 listings con MPN incorrecto.
      const nameMatch = title.match(/^(.*?) \[.*\]$/);
      if (nameMatch) {
        const baseName = nameMatch[1].trim();
        // Heurística: rechazar baseNames demasiado genéricos (sólo brand, ≤2 palabras útiles).
        const significantWords = baseName
          .replace(/\b(micro|mini|atx|matx|itx|gaming)\b/gi, "")
          .split(/\s+/)
          .filter((w) => w.length > 2);
        if (significantWords.length < 2) {
          this.logger.info(`Skipping title-based match for too-generic baseName: "${baseName}"`);
          return null;
        }

        const escapedName = baseName.replace(/[%_]/g, "\\$&");
        const { data: nameDuplicates } = await supabase
          .from("products")
          .select("id, mpn, specs, name")
          .ilike("name", `${escapedName} [%]`)
          .eq("category_id", categoryId)
          .eq("brand_id", brandId)
          .limit(5);

        if (nameDuplicates && nameDuplicates.length > 0) {
          // Si la consulta trae MPN, exigir que el MPN normalizado coincida.
          // Esto bloquea fusiones erróneas tipo "B850 GAMING PLUS WIFI" vs "B860 TOMAHAWK WIFI"
          // que sólo comparten brand+form factor en el título.
          const scrapedKey = mpn ? normalizeMpnKey(mpn) : "";
          const compatible = nameDuplicates.find((d) => {
            if (!scrapedKey) return true;
            const existingKey = normalizeMpnKey(d.mpn);
            return !existingKey || existingKey === scrapedKey;
          });

          if (!compatible) {
            this.logger.warn(
              `Name match found for "${baseName}" but MPNs incompatible (scraped="${mpn}", candidates=[${nameDuplicates.map((d) => d.mpn).join(", ")}]). Skipping.`,
            );
            return null;
          }

          this.logger.info(`Found similar product by normalized name: ${compatible.id}`);
          return compatible;
        }
      }

      // 2. Search by title similarity within same category and brand
      // Use title keywords to find potential matches
      const titleKeywords = title
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 3) // Filter short words
        .slice(0, 5); // Take first 5 significant words

      if (titleKeywords.length > 0) {
        const { data: candidates } = await supabase
          .from("products")
          .select("id, name, mpn, specs")
          .eq("category_id", categoryId)
          .eq("brand_id", brandId)
          .limit(50);

        if (candidates && candidates.length > 0) {
          const scrapedKey = mpn ? normalizeMpnKey(mpn) : "";
          let bestMatch: { id: string; mpn: string | null; specs: Json | null } | null = null;
          let bestScore = 0;

          for (const candidate of candidates) {
            const candidateName = (candidate.name || "").toUpperCase();
            const matchCount = titleKeywords.filter((keyword) => candidateName.includes(keyword)).length;
            const score = matchCount / titleKeywords.length;
            if (score > bestScore && score >= 0.9) {
              bestScore = score;
              bestMatch = {
                id: candidate.id,
                mpn: candidate.mpn,
                specs: candidate.specs,
              };
            }
          }

          if (bestMatch) {
            // Safeguard: si el candidato tiene MPN y nosotros también, exigir que sus
            // formas normalizadas coincidan. Sin esto, productos como
            // "Gigabyte B550M K" y "Gigabyte H610M K V2" se mergean por sus keywords
            // ("Gigabyte"/marca y forma común).
            if (scrapedKey && bestMatch.mpn) {
              const matchKey = normalizeMpnKey(bestMatch.mpn);
              if (matchKey && matchKey !== scrapedKey) {
                this.logger.warn(
                  `Title match (score=${bestScore.toFixed(2)}) rejected — MPN incompatible: scraped="${mpn}" vs existing="${bestMatch.mpn}"`,
                );
                bestMatch = null;
              }
            }
            if (bestMatch) {
              this.logger.info(
                `Found similar product by title match (score: ${bestScore.toFixed(2)}): ${bestMatch.id}`,
              );
              return bestMatch;
            }
          }
        }
      }

      // 3. If we have specs, try to match by key specifications
      if (specs && typeof specs === "object" && specs !== null) {
        const specsObj = specs as Record<string, unknown>;

        // Extract key identifying fields from specs
        const keyFields = ["model", "modelo", "part_number", "partnumber"];
        const identifyingValue = keyFields
          .map((field) => specsObj[field])
          .find((val) => typeof val === "string" && val.length > 0) as string | undefined;

        if (identifyingValue) {
          const { data: candidates } = await supabase
            .from("products")
            .select("id, mpn, specs")
            .eq("category_id", categoryId)
            .eq("brand_id", brandId)
            .not("specs", "is", null)
            .limit(50);

          if (candidates && candidates.length > 0) {
            for (const candidate of candidates) {
              if (!candidate.specs || typeof candidate.specs !== "object") continue;

              const candidateSpecs = candidate.specs as Record<string, unknown>;
              const candidateValue = keyFields
                .map((field) => candidateSpecs[field])
                .find((val) => typeof val === "string" && val.length > 0) as string | undefined;

              if (candidateValue && candidateValue.toLowerCase() === identifyingValue.toLowerCase()) {
                this.logger.info(`Found similar product by specs match: ${candidate.id}`);
                return {
                  id: candidate.id,
                  mpn: candidate.mpn,
                  specs: candidate.specs,
                };
              }
            }
          }
        }
      }

      return null;
    } catch (err) {
      this.logger.error("findSimilarProduct failed", (err as Error).message || String(err));
      return null;
    }
  }

  async upsertProductAndListing(
    product: {
      title?: string;
      mpn?: string | null;
      specs?: Json;
      brandId: string;
      categoryId: string;
      imageUrl?: string | null;
    },
    listing: {
      url?: string;
      price?: number | null;
      originalPrice?: number | null;
      stock?: boolean | number | null;
      stockQuantity?: number | null;
      storeId: string;
    },
    // If pending is true, the listing will be created/updated as inactive so it won't be public until
    // another process (e.g., Cortex) activates it after validating/generating specs.
    options?: { pending?: boolean },
  ): Promise<UpsertResult> {
    try {
      const normalizedTitle = product.title ?? `${product.mpn ?? "product"}`;

      // If product has mpn try to find existing (within same category, normalized comparison)
      let productId: string | null = null;
      if (product.mpn) {
        productId = await this.findExistingProductByMpn(product.mpn, product.categoryId);
      }

      if (!productId) {
        // El schema de prod ahora requiere `products.mpn NOT NULL`; rechazamos
        // explícitamente productos sin MPN (antes el insert fallaba a nivel DB).
        if (!product.mpn) {
          this.logger.warn(`Skipping product without MPN: ${normalizedTitle}`);
          return { productId: null, listingId: null };
        }
        const insert: TablesInsert<"products"> = {
          name: normalizedTitle,
          slug: `${nameToSlug(normalizedTitle)}-${Date.now()}`,
          mpn: product.mpn,
          category_id: product.categoryId,
          brand_id: product.brandId,
          image_url: product.imageUrl ?? null,
          specs: (product.specs as Json | null) ?? ({} as Json),
        };

        const { data, error } = await supabase.from("products").insert(insert).select("id").single();
        if (error) {
          const msg = (error as { message?: unknown }).message as string | undefined;
          // 23505 = unique_violation (`products_norm_mpn_per_category_idx`).
          // Race entre dos crawlers insertando el mismo MPN normalizado: re-buscamos.
          const code = (error as { code?: string }).code;
          if (code === "23505" && product.mpn) {
            this.logger.info(`Race condition on MPN insert: ${product.mpn}, refetching canonical`);
            productId = await this.findExistingProductByMpn(product.mpn, product.categoryId);
          }
          if (!productId) {
            this.logger.error("Failed to create product", msg ?? String(error));
            return { productId: null, listingId: null };
          }
        } else {
          productId = data?.id ?? null;
        }
      } else {
        // Fetch the existing product's current name + slug so we can decide
        // whether the incoming title carries a better (e.g. correct VRAM) name.
        const { data: existingProduct } = await supabase
          .from("products")
          .select("name, slug")
          .eq("id", productId)
          .single();

        const updatePayload: Record<string, unknown> = {};

        if (existingProduct?.name && normalizedTitle) {
          const decision = pickBetterName({
            existingName: existingProduct.name,
            newName: normalizedTitle,
            mpn: product.mpn,
          });

          if (decision.renamed) {
            const newSlug = `${nameToSlug(decision.name)}-${Date.now()}`;
            updatePayload.name = decision.name;
            updatePayload.slug = newSlug;
            // Insertar el slug viejo en product_slug_redirects para servir 301.
            // No bloqueamos el upsert si falla (es best-effort).
            if (existingProduct.slug && existingProduct.slug !== newSlug) {
              const { error: redirectError } = await supabase
                .from("product_slug_redirects")
                .insert({ old_slug: existingProduct.slug, product_id: productId });
              if (redirectError && !/duplicate key/i.test(redirectError.message ?? "")) {
                this.logger.warn(`Failed to record slug redirect for ${productId}: ${redirectError.message}`);
              }
            }
            this.logger.info("product_renamed", {
              product_id: productId,
              old_name: existingProduct.name,
              new_name: decision.name,
              old_slug: existingProduct.slug,
              new_slug: newSlug,
              reason: decision.reason,
              mpn: product.mpn,
            });
          } else if (decision.reason !== "same_gb_or_no_gb") {
            // Mismatch detected but we decided to keep existing — emit a warning so
            // we can spot data drift without churning slugs.
            this.logger.warn("product_name_mismatch_kept_existing", {
              product_id: productId,
              existing_name: existingProduct.name,
              candidate_name: normalizedTitle,
              reason: decision.reason,
              mpn: product.mpn,
            });
          }
        }

        // update specs if present
        if (product.specs) {
          updatePayload.specs = product.specs as Json;
        }

        if (Object.keys(updatePayload).length > 0) {
          const { error } = await supabase.from("products").update(updatePayload).eq("id", productId);
          if (error) {
            const msg = (error as { message?: unknown }).message as string | undefined;
            this.logger.error(`Failed to update product: ${productId}`, msg ?? String(error));
          }
        }
      }

      if (!productId) return { productId: null, listingId: null };

      // Check if listing exists to preserve is_active state
      const { data: existingListing } = await supabase
        .from("listings")
        .select("is_active")
        .eq("store_id", listing.storeId)
        .eq("external_id", listing.url ?? "")
        .single();

      let isActive = options?.pending ? false : !!(listing.price != null && listing.price > 0 && listing.stock);

      if (existingListing) {
        // If listing exists, we ignore the 'pending' flag for is_active calculation
        // because it has likely been reviewed already.
        // We update is_active based on the current scrape data.
        isActive = !!(listing.price != null && listing.price > 0 && listing.stock);
      }

      // If stock is explicitly false, ensure stock_quantity is 0 to indicate out-of-stock
      // This helps other services (like Cortex) know the stock status even if is_active is false
      const finalStockQuantity = listing.stockQuantity ?? (listing.stock === false || listing.stock === 0 ? 0 : null);

      const insertListing: TablesInsert<"listings"> = {
        store_id: listing.storeId,
        product_id: productId,
        url: listing.url ?? "",
        external_id: listing.url ?? "",
        price_cash: listing.price ?? undefined,
        price_normal: listing.originalPrice ?? listing.price ?? undefined,
        is_active: isActive,
        stock_quantity: finalStockQuantity,
        last_scraped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: listingData, error: listingError } = await supabase
        .from("listings")
        .upsert(insertListing, { onConflict: "store_id,external_id" })
        .select("id")
        .single();

      if (listingError) {
        const msg = (listingError as { message?: unknown }).message as string | undefined;
        this.logger.error("Failed to upsert listing", {
          message: msg ?? String(listingError),
          insertListing,
        });
        return { productId, listingId: null };
      }

      const listingId = listingData?.id ?? null;

      // Record price history
      if (listingId && insertListing.price_cash != null && insertListing.price_cash > 0) {
        const priceInsert: TablesInsert<"price_history"> = {
          listing_id: listingId,
          price_cash: insertListing.price_cash,
          price_normal: insertListing.price_normal ?? insertListing.price_cash,
        };
        await supabase.from("price_history").insert(priceInsert);
      }

      return { productId, listingId };
    } catch (err) {
      this.logger.error("upsertProductAndListing failed", (err as Error).message || String(err));
      return { productId: null, listingId: null };
    }
  }
}
