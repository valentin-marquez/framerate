/**
 * @module mpn-finder/opendb/resolver
 *
 * Resuelve un producto a su MPN canónico contra OpenDB (`products_canonical`).
 *
 * OpenDB (repo BuildCores) tiene specs canónicas de hardware: por cada producto,
 * `metadata.name` y `metadata.part_numbers` (un array con el nombre, el SKU y
 * los códigos de fabricante). La `category` la inyecta el sync desde la carpeta.
 *
 * Es la vía preferida para placas/CPU/GPU: gratis, local, sin LLM ni búsqueda
 * web — esas categorías están bien cubiertas en OpenDB.
 */
import { Logger } from "@framerate/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyMpnResult, type MpnCandidate, type MpnResult } from "../types";

/** Categoría interna de Framerate → carpeta de OpenDB. */
const CATEGORY_TO_OPENDB: Record<string, string> = {
  gpu: "GPU",
  cpu: "CPU",
  motherboard: "Motherboard",
  ram: "RAM",
  psu: "PSU",
  case: "PCCase",
  cpu_cooler: "CPUCooler",
  case_fan: "CaseFan",
  ssd: "Storage",
  hdd: "Storage",
};

/** Containment mínimo del nombre canónico en el título para aceptar el match. */
const MIN_SCORE = 0.8;

interface CanonicalEntry {
  name: string;
  tokens: string[];
  partNumbers: string[];
}

/** Tokeniza a minúsculas, sólo alfanumérico, descartando tokens muy cortos. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/** 1 si el string parece un código de fabricante (con dígitos, sin espacios). */
function codeLikeness(pn: string): number {
  const s = pn.trim();
  if (!/\d/.test(s)) return 0; // sin dígitos → probablemente un nombre de modelo
  if (/\s/.test(s)) return 0; // con espacios → nombre, no código
  if (s.length < 5 || s.length > 30) return 0;
  return 1;
}

/** Resuelve títulos de producto a MPN canónico vía OpenDB. */
export class OpenDbResolver {
  private readonly logger = new Logger("OpenDbResolver");
  private index: Map<string, CanonicalEntry[]> | null = null;
  private loading: Promise<void> | null = null;

  constructor(private readonly supabase: SupabaseClient) {}

  /** Carga `products_canonical` en memoria, indexado por categoría. Una sola vez. */
  private async load(): Promise<void> {
    const index = new Map<string, CanonicalEntry[]>();
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.supabase
        .from("products_canonical")
        .select("specifications")
        .eq("is_deleted", false)
        .range(from, from + PAGE - 1);
      if (error) {
        this.logger.error(`Carga de OpenDB falló: ${error.message}`);
        break;
      }
      if (!data || data.length === 0) break;
      for (const row of data) {
        const spec = (row.specifications ?? {}) as Record<string, unknown>;
        const category = typeof spec.category === "string" ? spec.category : null;
        const meta = (spec.metadata ?? {}) as Record<string, unknown>;
        const name = typeof meta.name === "string" ? meta.name : null;
        const partNumbers = Array.isArray(meta.part_numbers)
          ? (meta.part_numbers as unknown[]).filter((p): p is string => typeof p === "string" && p.trim().length > 0)
          : [];
        if (!category || !name || partNumbers.length === 0) continue;
        const list = index.get(category) ?? [];
        list.push({ name, tokens: tokenize(name), partNumbers });
        index.set(category, list);
      }
      if (data.length < PAGE) break;
    }
    this.index = index;
    const total = [...index.values()].reduce((sum, list) => sum + list.length, 0);
    this.logger.info(`OpenDB cargado: ${total} productos en ${index.size} categorías`);
  }

  /**
   * Resuelve `title` (en la categoría `category` de Framerate) a su MPN
   * canónico. Matchea por containment de tokens del nombre canónico en el
   * título; el más alto por encima de {@link MIN_SCORE} gana. Devuelve los
   * `part_numbers` del producto, los más parecidos a código primero.
   */
  async resolve(title: string, category: string): Promise<MpnResult> {
    try {
      if (!this.index) {
        if (!this.loading) this.loading = this.load();
        await this.loading;
      }
      const odbCategory = CATEGORY_TO_OPENDB[category];
      const entries = odbCategory ? this.index?.get(odbCategory) : undefined;
      if (!entries || entries.length === 0) return emptyMpnResult(title);

      const titleTokens = new Set(tokenize(title));
      let best: CanonicalEntry | null = null;
      let bestScore = 0;
      for (const entry of entries) {
        if (entry.tokens.length === 0) continue;
        const matched = entry.tokens.filter((t) => titleTokens.has(t)).length;
        const score = matched / entry.tokens.length;
        if (score > bestScore) {
          bestScore = score;
          best = entry;
        }
      }

      if (!best || bestScore < MIN_SCORE) return emptyMpnResult(title);

      const ordered = [...best.partNumbers].sort((a, b) => codeLikeness(b) - codeLikeness(a) || a.length - b.length);
      const confidence = Math.round(bestScore * 100) / 100;
      const mpns: MpnCandidate[] = ordered.map((value) => ({ value, variant: "unknown", confidence }));
      return { query: title, mpns, canonicalName: best.name, notes: null, source: "opendb" };
    } catch (error) {
      this.logger.error(`resolve falló para "${title}":`, String(error));
      return emptyMpnResult(title);
    }
  }
}
