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

  // Store context raw (crudo) as the user requested. If undefined, save as null.
  const rawContext = context ?? null;

  try {
    logger.info(
      `Enqueuing AI job for MPN=${mpn} category=${category} contextType=${rawContext === null ? "null" : typeof rawContext}`,
    );

    const { error } = await supabase.from("extraction_jobs").insert({
      mpn,
      category,
      raw_text: text,
      context: rawContext,
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
    try {
      const preview =
        context == null
          ? String(context)
          : typeof context === "string"
            ? context.slice(0, 200)
            : JSON.stringify(context).slice(0, 200);
      logger.info(
        `IA extract invoked for mpn=${mpn} category=${category} contextType=${context == null ? "null" : typeof context} ctxPreview=${preview}`,
      );
    } catch (_e) {}

    const { data: cached, error: cacheError } = await supabase
      .from("extraction_jobs")
      .select("result")
      .eq("mpn", mpn)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!cacheError && cached && cached.result) {
      logger.info(`Cache HIT para MPN: ${mpn}`);
      try {
        if (context && typeof context.onCacheHit === "function") context.onCacheHit();
      } catch (_) {}
      // biome-ignore lint/suspicious/noExplicitAny: result is jsonb
      return (cached.result as any).specs as T;
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
