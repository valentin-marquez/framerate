import type { HddSpecs } from "@framerate/db";
import { HddSchema } from "@framerate/db";
import { BaseExtractor, type FieldMapping, fieldMappingsToHints } from "@/strategies/base";

const FIELD_MAPPINGS = {
  rpm: {
    sources: ["Velocidad de rotación del HDD", "RPM", "RPM (_mfa_XXXX)"],
    note: 'solo el número, ej: "5400 rpm" → 5400',
  },
  read_speed_mb_s: {
    sources: ["Velocidad de lectura", "Velocidad de transferencia de impulso sostenido del HDD"],
  },
  write_speed_mb_s: {
    sources: ["Velocidad de escritura"],
  },
  form_factor: {
    sources: ["Tamaño del HDD"],
  },
  cache_mb: {
    sources: ["Tamaño de unidad de almacenamiento de búfer", "Cache"],
  },
} as const satisfies Record<string, FieldMapping>;

/** Regex para extraer RPM y cache del raw_text Icecat. */
const RPM_RE = /(?:Velocidad de rotación del HDD|RPM[^"]*)"?\s*[:]\s*"?(\d{4,5})\s*(?:RPM|rpm)/i;
const CACHE_RE = /(?:unidad de almacenamiento de búfer|[Cc]ache)[^"]*"\s*:\s*"(\d+)\s*(MB|GB)/i;

export class HddStrategy extends BaseExtractor<HddSpecs> {
  protected getZodSchema() {
    return HddSchema;
  }

  protected getFieldMappingHints(): string {
    return fieldMappingsToHints(FIELD_MAPPINGS);
  }

  async process(job: {
    raw_text?: string | null;
    normalized_title?: string | null;
    mpn?: string;
    category?: string;
    context?: Record<string, unknown> | undefined;
  }) {
    const enhancedContext = { ...job.context, normalized_title: job.normalized_title };
    const title = job.normalized_title || (job.context?.title as string | undefined);
    const searchQuery = title ? `${title} specs` : job.mpn ? `${job.mpn} specs` : undefined;

    const { specs, foundMpn } = await this.extractWithRetry(
      `${job.raw_text ?? ""}`,
      enhancedContext,
      2,
      searchQuery,
      job.category,
      job.mpn,
    );

    // Post-process: extract RPM and cache the LLM misses from Icecat field names
    const rawText = job.raw_text ?? "";
    const s = specs as Record<string, unknown>;
    if (!s.rpm) {
      const m = rawText.match(RPM_RE);
      if (m) s.rpm = Number(m[1]);
    }
    if (!s.cache_mb) {
      const m = rawText.match(CACHE_RE);
      if (m) s.cache_mb = m[2] === "GB" ? Number(m[1]) * 1024 : Number(m[1]);
    }

    return {
      extracted: true,
      processed_at: new Date().toISOString(),
      mpn: foundMpn || job.mpn,
      category: job.category,
      specs,
    };
  }
}
