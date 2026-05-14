import type { GpuSpecs } from "@framerate/db";
import { GpuSchema } from "@framerate/db";
import { BaseExtractor, type FieldMapping, fieldMappingsToHints } from "@/strategies/base";

const FIELD_MAPPINGS = {
  core_base_clock_mhz: {
    sources: ["Frecuencia del procesador", "Frecuencia base del procesador"],
  },
  core_boost_clock_mhz: {
    sources: ["Aumento de la velocidad de reloj del procesador", "Frecuencia boost", "Reloj de núcleo"],
  },
  core_count: {
    sources: ["Núcleos CUDA"],
  },
  memory_bus_bit: {
    sources: ["Ancho de datos"],
    note: 'solo el número, ej: "128 bit" → 128',
  },
  tdp_w: {
    sources: ["Consumo de energía (max)", "Consumo energético", "Consumo"],
    note: "solo watts",
  },
  length_mm: {
    sources: ["Longitud"],
    note: "convertir cm a mm si es necesario",
  },
  slots: {
    sources: ["Número de ranuras"],
  },
  "video_ports.hdmi": {
    sources: ["Número de puertos HDMI"],
  },
  "video_ports.displayport": {
    sources: ["Cantidad de DisplayPorts"],
  },
  "video_ports.dvi": {
    sources: ["Cantidad de puertos DVI-D", "Cantidad de puertos DVI-I"],
    note: "sumar ambos",
  },
  "video_ports.vga": {
    sources: ["Cantidad de puertos VGA (D-Sub)"],
  },
  frame_sync: {
    sources: ['NVIDIA G-SYNC = "Si"'],
    note: 'si es "Si" → "G-SYNC"',
  },
  color: {
    sources: ["Color del producto"],
    note: "como array",
  },
  architecture: {
    sources: [],
    note: 'inferir del chipset: RTX 50XX="Blackwell", RTX 40XX="Ada Lovelace", RTX 30XX="Ampere", RX 7XXX="RDNA 3", RX 9XXX="RDNA 4"',
  },
} as const satisfies Record<string, FieldMapping>;

export class GpuStrategy extends BaseExtractor<GpuSpecs> {
  protected getZodSchema() {
    return GpuSchema;
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
    return {
      extracted: true,
      processed_at: new Date().toISOString(),
      mpn: foundMpn || job.mpn,
      category: job.category,
      specs,
    };
  }
}
