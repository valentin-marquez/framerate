import { config } from "@/config";
import { supabase } from "@/db";
import logger from "@/logger";
import { type Job, JobSchema, type StrategyResult, StrategyResultSchema } from "@/schemas";
import { getStrategy } from "@/strategies";

function isTransientError(err: unknown) {
  if (!err) return false;
  const s = String(err);
  return s.includes("timeout") || s.includes("429") || s.includes("ECONNREFUSED");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function processJob(jobRaw: unknown) {
  // Validate job shape
  const parsed = JobSchema.safeParse(jobRaw);
  if (!parsed.success) {
    logger.error("Invalid job received, cannot process:", parsed.error.format());
    // biome-ignore lint/suspicious/noExplicitAny: jobRaw is untyped input
    const maybeId = (jobRaw as any)?.id;
    if (maybeId) {
      await supabase
        .from("extraction_jobs")
        .update({ status: "failed", error_message: `Invalid job shape: ${JSON.stringify(parsed.error.issues)}` })
        .eq("id", maybeId);
    }
    return;
  }

  const job: Job = parsed.data;
  const start = Date.now();

  try {
    logger.info(`Processing job ${job.id} (mpn=${job.mpn}, category=${job.category})`);

    const strategy = getStrategy(job.category);

    const rawResult = await strategy.process(job);

    const resParsed = StrategyResultSchema.safeParse(rawResult);
    if (!resParsed.success) {
      logger.error(`Strategy returned invalid result for job ${job.id}:`, resParsed.error.format());
      await supabase
        .from("extraction_jobs")
        .update({ status: "failed", error_message: `Invalid strategy result` })
        .eq("id", job.id);
      return;
    }

    const result: StrategyResult = resParsed.data;

    await supabase
      .from("extraction_jobs")
      .update({ status: "completed", result: JSON.stringify(result), updated_at: new Date().toISOString() })
      .eq("id", job.id);

    logger.info(`Job ${job.id} completed in ${Date.now() - start}ms`);

    // Post-processing: if the strategy returned specs, cache them and activate product/listings
    try {
      // Only attempt to write cache/update product if we have specs
      // biome-ignore lint/suspicious/noExplicitAny: result can contain arbitrary keys from strategies
      const specs = (result as any)?.specs;
      // biome-ignore lint/suspicious/noExplicitAny: access pass-through fields
      const price = (result as any)?.price ?? (job as any)?.price;
      // biome-ignore lint/suspicious/noExplicitAny: access pass-through fields
      const stock = (result as any)?.stock_level ?? (job as any)?.stock_level;

      if (specs) {
        // Validate specs against product schemas before applying
        try {
          // Importing lazily to avoid circular or unused imports at module load
          const { ProductSpecsSchema } = await import("@framerate/db");

          const parsed = ProductSpecsSchema.safeParse(specs);
          if (!parsed.success) {
            logger.warn(`Specs validation failed for mpn=${job.mpn}: ${JSON.stringify(parsed.error.issues)}`);
          } else {
            // Handle product update with potential MPN correction.
            // Sólo aceptamos un foundMpn distinto si normalizado es compatible (idéntico o
            // uno es prefijo del otro). Si OpenDB devuelve un MPN claramente distinto
            // (e.g., scraped "90MB1IS0-M0EAY0" → opendb "MB063ASU23"), no lo aplicamos.
            // biome-ignore lint/suspicious/noExplicitAny: resultado sin tipo genérico
            const foundMpn = (result as any)?.mpn as string | undefined;
            const normalize = (m: string | null | undefined) => (m ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
            const jobKey = normalize(job.mpn);
            const foundKey = normalize(foundMpn);
            const foundCompatible =
              !foundMpn ||
              foundMpn === job.mpn ||
              (jobKey &&
                foundKey &&
                (jobKey === foundKey || jobKey.startsWith(foundKey) || foundKey.startsWith(jobKey)));

            if (foundMpn && foundMpn !== job.mpn && !foundCompatible) {
              logger.warn(`Ignoring OpenDB foundMpn="${foundMpn}" — incompatible with job.mpn="${job.mpn}"`);
            }
            let targetMpn = foundMpn && foundMpn !== job.mpn && foundCompatible ? foundMpn : job.mpn;

            const { data: originalProd } = await supabase
              .from("products")
              .select("id, name, mpn, category_id, brand_id")
              .eq("mpn", job.mpn)
              .single();

            if (originalProd?.id) {
              let targetProductId = originalProd.id;

              // Check for duplicates by name, with MPN-compatibility safeguards.
              // Without these, we'd merge "B850 GAMING PLUS WIFI" into "B860 TOMAHAWK WIFI"
              // just because both end up titled "Brand [...]".
              if (originalProd.name) {
                const nameMatch = originalProd.name.match(/^(.*?) \[.*\]$/);
                if (nameMatch) {
                  const baseName = nameMatch[1].trim();
                  // Reject too-generic baseNames (only brand + form factor).
                  const significantWords = baseName
                    .replace(/\b(micro|mini|atx|matx|itx|gaming)\b/gi, "")
                    .split(/\s+/)
                    .filter((w) => w.length > 2);

                  if (significantWords.length < 2) {
                    logger.info(`Skipping name-merge for too-generic baseName: "${baseName}"`);
                  } else {
                    const escapedName = baseName.replace(/[%_]/g, "\\$&");
                    const { data: duplicates } = await supabase
                      .from("products")
                      .select("id, mpn, name")
                      .ilike("name", `${escapedName} [%]`)
                      .eq("category_id", originalProd.category_id)
                      .eq("brand_id", originalProd.brand_id)
                      .neq("id", originalProd.id)
                      .limit(5);

                    if (duplicates && duplicates.length > 0) {
                      const normalize = (m: string | null | undefined) =>
                        (m ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
                      const jobKey = normalize(job.mpn);

                      // Compatibility: MPNs are compatible iff one is a prefix of the other
                      // (covers "B850M D3HP" ⊂ "B850M-D3HP" or full vs short SKUs from same vendor).
                      // Disjoint MPNs (e.g., 90MB1IS0-M0EAY0 vs MB063ASU23) are NOT compatible.
                      const compatibleDuplicates = duplicates.filter((d) => {
                        if (!d.mpn) return true;
                        const dKey = normalize(d.mpn);
                        if (!dKey || !jobKey) return true;
                        return dKey === jobKey || dKey.startsWith(jobKey) || jobKey.startsWith(dKey);
                      });

                      if (compatibleDuplicates.length === 0) {
                        logger.warn(
                          `Name match "${baseName}" found ${duplicates.length} candidate(s) but MPNs incompatible (job=${job.mpn}, candidates=[${duplicates.map((d) => d.mpn).join(", ")}]). Skipping merge.`,
                        );
                      } else {
                        // Pick the most specific (longest) MPN among compatible candidates.
                        const bestDuplicate = compatibleDuplicates.reduce((best, current) => {
                          const bestMpnLen = best.mpn?.length ?? 0;
                          const currentMpnLen = current.mpn?.length ?? 0;
                          return currentMpnLen > bestMpnLen ? current : best;
                        });

                        if (bestDuplicate.mpn && bestDuplicate.mpn !== job.mpn) {
                          logger.info(
                            `Found duplicate by name "${baseName}". Merging ${job.mpn} -> ${bestDuplicate.mpn} (product: ${bestDuplicate.id})`,
                          );
                          targetMpn = bestDuplicate.mpn;
                        }
                      }
                    }
                  }
                }
              }

              if (targetMpn !== job.mpn) {
                logger.info(`Correcting product MPN from ${job.mpn} to ${targetMpn}`);
                const { data: existingTarget } = await supabase
                  .from("products")
                  .select("id")
                  .eq("mpn", targetMpn)
                  .single();

                if (existingTarget) {
                  // Merge: Target MPN already exists. Move listings and delete original.
                  logger.info(`Product merge: ${originalProd.id} -> ${existingTarget.id}`);
                  await supabase
                    .from("listings")
                    .update({ product_id: existingTarget.id })
                    .eq("product_id", originalProd.id);
                  // Optionally log deletion or archive? For now, hard delete to avoid duplication.
                  await supabase.from("products").delete().eq("id", originalProd.id);
                  targetProductId = existingTarget.id;
                } else {
                  // Rename: valid update
                  await supabase.from("products").update({ mpn: targetMpn }).eq("id", originalProd.id);
                }
              }

              // Update specs on the final target product
              await supabase.from("products").update({ specs }).eq("id", targetProductId);

              // Update Listing Price/Stock/Activity
              // If we have a URL, we can identify the specific listing efficiently
              if (job.url) {
                const updateData: any = { last_updated: new Date().toISOString() };
                if (price !== undefined) updateData.price_cash = price;
                if (stock !== undefined) updateData.stock_quantity = stock;
                // If we have valid price/stock, ensure it is active
                if ((price && price > 0) || (stock && stock > 0)) {
                  updateData.is_active = true;
                }

                await supabase.from("listings").update(updateData).eq("url", job.url);
              } else {
                // Fallback: activate listings by product ID if we don't have URL (legacy behavior)
                const { data: listings } = await supabase
                  .from("listings")
                  .select("id, price_cash, stock_quantity")
                  .eq("product_id", targetProductId)
                  .eq("is_active", false);

                if (listings && listings.length > 0) {
                  const toActivate = listings
                    .filter((l) => (l.price_cash ?? 0) > 0 && (l.stock_quantity || 0) !== 0)
                    .map((l) => l.id);

                  if (toActivate.length > 0) {
                    await supabase.from("listings").update({ is_active: true }).in("id", toActivate);
                  }
                }
              }
            }
          }
        } catch (err) {
          logger.error(`Error during post-processing for job ${job.id}:`, err);
        }
      }
    } catch (err) {
      logger.error(`Unexpected post-processing error for job ${job.id}:`, err);
    }
  } catch (err) {
    logger.error(`Job ${(job && (job as Job).id) || "<unknown>"} failed:`, err);
    const attempts = (job && (job as Job).attempts) ?? 0;

    if (isTransientError(err) && attempts < config.CORTEX_MAX_ATTEMPTS && job) {
      const backoff = config.CORTEX_BACKOFF_BASE_MS * 2 ** attempts;
      logger.info(`Transient error, requeuing job ${job.id} after ${backoff}ms (attempt ${attempts})`);
      await supabase
        .from("extraction_jobs")
        .update({ status: "pending", error_message: String(err), updated_at: new Date().toISOString() })
        .eq("id", job.id);
      await sleep(backoff);
      return;
    }

    await supabase
      .from("extraction_jobs")
      .update({ status: "failed", error_message: String(err), updated_at: new Date().toISOString() })
      // biome-ignore lint/suspicious/noExplicitAny: jobRaw is untyped input
      .eq("id", (job && (job as Job).id) || (jobRaw as any)?.id);
  }
}
