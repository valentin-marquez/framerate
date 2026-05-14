import type { Json } from "@framerate/db";
import { Logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

/**
 * Simplified helpers for AI extraction in Collector.
 * - No LLM calls here; Collector only checks cache and enqueues jobs for Cortex to process.
 */

export interface ExtractionOptions {
  normalizedTitle?: string;
  brand?: string;
  url?: string;
}

export type ExtractionContext =
  | string
  | (Record<string, unknown> & {
      onCacheHit?: () => void;
      onLlmCall?: () => void;
    });

export async function scheduleExtraction(
  category: string,
  mpn: string,
  text: string,
  context?: ExtractionContext,
  options?: ExtractionOptions,
): Promise<void> {
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
      context: rawContext as Json,
      normalized_title: options?.normalizedTitle,
      brand: options?.brand,
      url: options?.url,
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
  context?: ExtractionContext,
  options?: ExtractionOptions,
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
        if (context && typeof context === "object" && typeof context.onCacheHit === "function") context.onCacheHit();
      } catch (_) {}
      const result = (cached.result ?? {}) as { specs?: unknown };
      return (result.specs ?? null) as T | null;
    }

    try {
      if (context && typeof context === "object" && typeof context.onLlmCall === "function") context.onLlmCall();
    } catch (_) {}

    await scheduleExtraction(category, mpn, text, context, options);
    return null;
  } catch (error) {
    logger.error(`Error en el proceso de encolado para MPN ${mpn}:`, String(error));
    return null;
  }
}
