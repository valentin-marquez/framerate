/**
 * @module @framerate/mpn-finder
 *
 * Servicio de resolución de MPN (Fase 2 del dedup de productos entre tiendas).
 *
 * Distintas tiendas publican distinto identificador para el mismo producto
 * (unas el MPN del fabricante, otras sólo el EAN). `MpnFinder` resuelve un
 * producto (título / EAN) a su **MPN canónico** vía: caché → búsqueda web →
 * extracción LLM → caché.
 */

import { Logger } from "@framerate/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseMpnCache } from "./cache/mpn-cache";
import { DeepSeekExtractor } from "./extractors/deepseek-extractor";
import { DuckDuckGoProvider } from "./providers";
import {
  emptyMpnResult,
  type LlmExtractor,
  type MpnCache,
  type MpnResult,
  type SearchProvider,
  type SearchResult,
} from "./types";

export { SupabaseMpnCache } from "./cache/mpn-cache";
export { DeepSeekExtractor } from "./extractors/deepseek-extractor";
export { DuckDuckGoProvider, parseResults } from "./providers";
export * from "./types";

export interface MpnFinderOptions {
  /** Proveedores de búsqueda, probados en orden hasta que uno devuelva resultados. */
  providers: SearchProvider[];
  /** Extractor LLM que saca el MPN de los resultados de búsqueda. */
  extractor: LlmExtractor;
  /** Caché de resoluciones. */
  cache: MpnCache;
  /** Cuántos resultados de búsqueda pasar al extractor. Default 5. */
  searchLimit?: number;
}

/**
 * Orquestador del servicio. Resuelve una query a su MPN canónico encadenando
 * caché → búsqueda → extracción → caché. Tolerante a fallos de punta a punta:
 * `findMpn` nunca lanza — ante cualquier problema devuelve un resultado vacío.
 */
export class MpnFinder {
  private readonly logger = new Logger("MpnFinder");
  private readonly providers: SearchProvider[];
  private readonly extractor: LlmExtractor;
  private readonly cache: MpnCache;
  private readonly searchLimit: number;

  constructor(options: MpnFinderOptions) {
    this.providers = options.providers;
    this.extractor = options.extractor;
    this.cache = options.cache;
    this.searchLimit = options.searchLimit ?? 5;
  }

  /**
   * Resuelve `query` (título de producto o EAN) a su MPN canónico.
   * Cachea incluso los resultados vacíos: evita repetir una búsqueda + llamada
   * LLM costosas para una query que ya se demostró irresoluble.
   */
  async findMpn(query: string): Promise<MpnResult> {
    const trimmed = query.trim();
    if (!trimmed) return emptyMpnResult(query);

    try {
      const cached = await this.cache.get(trimmed);
      if (cached) {
        this.logger.info(`Cache hit: "${trimmed}"`);
        return { ...cached, query, source: "cache" };
      }

      let results: SearchResult[] = [];
      let usedProvider = "";
      for (const provider of this.providers) {
        results = await provider.search(trimmed, this.searchLimit);
        if (results.length > 0) {
          usedProvider = provider.name;
          break;
        }
      }

      if (results.length === 0) {
        this.logger.warn(`Sin resultados de búsqueda para: "${trimmed}"`);
        return emptyMpnResult(query);
      }

      const extracted = await this.extractor.extract(trimmed, results);
      const result: MpnResult = {
        ...extracted,
        query,
        source: extracted.mpns.length > 0 ? `${usedProvider}+llm` : "none",
      };

      await this.cache.set(trimmed, result);
      this.logger.info(`Resuelto "${trimmed}" → ${result.mpns.length} MPN(s) [${result.source}]`);
      return result;
    } catch (error) {
      this.logger.error(`findMpn falló para "${trimmed}":`, String(error));
      return emptyMpnResult(query);
    }
  }
}

/**
 * Construye un `MpnFinder` con el stack por defecto: búsqueda DuckDuckGo,
 * extracción DeepSeek y caché en Supabase. El cliente Supabase (service role)
 * lo provee el consumidor — este package no resuelve credenciales.
 */
export function createMpnFinder(supabase: SupabaseClient): MpnFinder {
  return new MpnFinder({
    providers: [new DuckDuckGoProvider()],
    extractor: new DeepSeekExtractor(),
    cache: new SupabaseMpnCache(supabase),
  });
}
