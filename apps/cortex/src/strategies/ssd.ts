import type { SsdSpecs } from "@framerate/db";
import { SsdSchema } from "@framerate/db";
import { BaseExtractor, type FieldMapping, fieldMappingsToHints } from "@/strategies/base";

const FIELD_MAPPINGS = {
  read_speed_mb_s: {
    sources: [
      "Velocidad de lectura",
      "Velocidad de lectura secuencial (ATTO)",
      "Velocidad de lectura secuencial (CDM)",
      "Velocidad de lectura secuencial (AS SSD)",
      "Lectura secuencial",
    ],
    note: "solo el número en MB/s",
  },
  write_speed_mb_s: {
    sources: [
      "Velocidad de escritura",
      "Velocidad de escritura secuencial (ATTO)",
      "Velocidad de escritura secuencial (CDM)",
      "Velocidad de escritura secuencial (AS SSD)",
      "Escritura secuencial",
    ],
    note: "solo el número en MB/s",
  },
  capacity_gb: {
    sources: ["SDD, capacidad", "Capacidad SSD"],
    note: "convertir TB a GB si es necesario: 1 TB = 1000 GB",
  },
  form_factor: {
    sources: ["Factor de forma de disco SSD"],
  },
  nvme: {
    sources: ["NVMe"],
    note: '"Si" → true',
  },
} as const satisfies Record<string, FieldMapping>;

/** Regex para extraer velocidades de lectura/escritura del raw_text Icecat. */
const READ_SPEED_RE =
  /(?:Velocidad de lectura(?: secuencial)?(?:\s*\([^)]*\))?|Lectura secuencial)"\s*:\s*"(\d+)\s*MB\/s/i;
const WRITE_SPEED_RE =
  /(?:Velocidad de escritura(?: secuencial)?(?:\s*\([^)]*\))?|Escritura secuencial)"\s*:\s*"(\d+)\s*MB\/s/i;

export class SsdStrategy extends BaseExtractor<SsdSpecs> {
  protected getZodSchema() {
    return SsdSchema;
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

    // Post-process: extract speeds the LLM misses from Icecat field names
    const rawText = job.raw_text ?? "";
    const s = specs as Record<string, unknown>;
    if (!s.read_speed_mb_s) {
      const m = rawText.match(READ_SPEED_RE);
      if (m) s.read_speed_mb_s = Number(m[1]);
    }
    if (!s.write_speed_mb_s) {
      const m = rawText.match(WRITE_SPEED_RE);
      if (m) s.write_speed_mb_s = Number(m[1]);
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
