import { Logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

/**
 * Simplified helpers for AI extraction in Collector.
 * - No LLM calls here; Collector only checks cache and enqueues jobs for Cortex to process.
 */

// biome-ignore lint/suspicious/noExplicitAny: Context can be anything
export async function scheduleExtraction(category: string, mpn: string, text: string, context?: any): Promise<void> {
  const logger = new Logger("IAExtractor");
  if (!mpn) {
    logger.warn("No MPN provided, skipping job enqueue.");
    return;
  }

  try {
    const { error } = await supabase.from("ai_extraction_jobs").insert({
      mpn,
      category,
      raw_text: text,
      context: context ?? null,
    });

    if (error) {
      logger.error(`Error enqueuing job for MPN ${mpn}:`, error.message || error);
    } else {
      logger.info(`Job enqueued for MPN: ${mpn}`);
    }
  } catch (error) {
    logger.error(`Error enqueuing job for MPN ${mpn}:`, String(error));
  }
}

export async function extractForCategory<T = unknown>(
  category: string,
  mpn: string,
  text: string,
  context?: any,
): Promise<T | null> {
  const logger = new Logger("IAExtractor");
  if (!mpn) {
    logger.warn("No se proporcionó MPN, omitiendo extracción de IA.");
    return null;
  }

  try {
    const { data: cached, error: cacheError } = await supabase
      .from("cached_specs_extractions")
      .select("specs")
      .eq("mpn", mpn)
      .single();

    if (!cacheError && cached) {
      logger.info(`Cache HIT para MPN: ${mpn}`);
      try {
        if (context && typeof context.onCacheHit === "function") context.onCacheHit();
      } catch (_) {}
      return cached.specs as T;
    }

    try {
      if (context && typeof context.onLlmCall === "function") context.onLlmCall();
    } catch (_) {}

    await scheduleExtraction(category, mpn, text, context);
    return null;
  } catch (error) {
    logger.error(`Error en el proceso de encolado para MPN ${mpn}:`, String(error));
    return null;
  }
}
