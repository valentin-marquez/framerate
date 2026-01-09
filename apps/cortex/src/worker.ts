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
      if (specs) {
        // Validate specs against product schemas before applying
        try {
          // Importing lazily to avoid circular or unused imports at module load
          const { ProductSpecsSchema } = await import("@framerate/db");

          const parsed = ProductSpecsSchema.safeParse(specs);
          if (!parsed.success) {
            logger.warn(`Specs validation failed for mpn=${job.mpn}: ${JSON.stringify(parsed.error.issues)}`);
          } else {
            // Handle product update with potential MPN correction
            const foundMpn = (result as any)?.mpn;
            let targetMpn = foundMpn && foundMpn !== job.mpn ? foundMpn : job.mpn;

            const { data: originalProd } = await supabase
              .from("products")
              .select("id, name, mpn, category_id, brand_id")
              .eq("mpn", job.mpn)
              .single();

            if (originalProd?.id) {
              let targetProductId = originalProd.id;

              // Always check for duplicates by name, even if we found MPN from LLM
              if (originalProd.name) {
                const nameMatch = originalProd.name.match(/^(.*?) \[.*\]$/);
                if (nameMatch) {
                  const baseName = nameMatch[1].trim();
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
                    // Find the "best" MPN (longest, most specific)
                    const bestDuplicate = duplicates.reduce((best, current) => {
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

              const { data: listings } = await supabase
                .from("listings")
                .select("id, price_cash, stock_quantity")
                .eq("product_id", targetProductId)
                .eq("is_active", false);

              if (listings && listings.length > 0) {
                const toActivate = listings
                  .filter((l) => (l.price_cash ?? 0) > 0 && l.stock_quantity !== 0)
                  .map((l) => l.id);

                if (toActivate.length > 0) {
                  await supabase.from("listings").update({ is_active: true }).in("id", toActivate);
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
