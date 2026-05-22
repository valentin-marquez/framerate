/**
 * @module @framerate/mpn-finder
 *
 * Servicio de resolución de MPN (Fase 2 del dedup de productos entre tiendas).
 *
 * Distintas tiendas publican distinto identificador para el mismo producto
 * (unas el MPN del fabricante, otras sólo el EAN). `MpnFinder` resuelve un
 * producto a su **MPN canónico** vía: caché → OpenDB → búsqueda web + LLM →
 * caché. OpenDB va primero por ser gratis e instantáneo (cubre bien
 * placas/CPU/GPU); la búsqueda web es el fallback.
 */

import { Logger } from "@framerate/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseMpnCache } from "./cache/mpn-cache";
import { DeepSeekExtractor } from "./extractors/deepseek-extractor";
import { OpenDbResolver } from "./opendb/resolver";
import { BraveSearchProvider, DuckDuckGoProvider } from "./providers";
import { cleanSearchQuery } from "./query";
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
export { OpenDbResolver } from "./opendb/resolver";
export { BraveSearchProvider, DuckDuckGoProvider, parseResults } from "./providers";
export { cleanSearchQuery } from "./query";
export * from "./types";

export interface MpnFinderOptions {
  /** Proveedores de búsqueda, probados en orden hasta que uno devuelva resultados. */
  providers: SearchProvider[];
  /** Extractor LLM que saca el MPN de los resultados de búsqueda. */
  extractor: LlmExtractor;
  /** Caché de resoluciones. */
  cache: MpnCache;
  /** Resolver de OpenDB. Si está y se pasa categoría, se intenta primero (gratis). */
  openDbResolver?: OpenDbResolver;
  /** Cuántos resultados de búsqueda pasar al extractor. Default 5. */
  searchLimit?: number;
}

/** Opciones de una resolución puntual. */
export interface FindMpnOptions {
  /** Categoría interna de Framerate (`cpu`, `gpu`, `motherboard`, …). Habilita OpenDB. */
  category?: string;
}

/**
 * Orquestador del servicio. Resuelve una query a su MPN canónico encadenando
 * caché → OpenDB → búsqueda web + LLM → caché. Tolerante a fallos de punta a
 * punta: `findMpn` nunca lanza — ante cualquier problema devuelve vacío.
 */
export class MpnFinder {
  private readonly logger = new Logger("MpnFinder");
  private readonly providers: SearchProvider[];
  private readonly extractor: LlmExtractor;
  private readonly cache: MpnCache;
  private readonly openDbResolver?: OpenDbResolver;
  private readonly searchLimit: number;

  constructor(options: MpnFinderOptions) {
    this.providers = options.providers;
    this.extractor = options.extractor;
    this.cache = options.cache;
    this.openDbResolver = options.openDbResolver;
    this.searchLimit = options.searchLimit ?? 5;
  }

  /**
   * Resuelve `query` (título de producto o EAN) a su MPN canónico.
   * Cachea incluso los resultados vacíos: evita repetir una búsqueda + llamada
   * LLM costosas para una query que ya se demostró irresoluble.
   */
  async findMpn(query: string, options?: FindMpnOptions): Promise<MpnResult> {
    const trimmed = query.trim();
    if (!trimmed) return emptyMpnResult(query);

    try {
      const cached = await this.cache.get(trimmed);
      if (cached) {
        this.logger.info(`Cache hit: "${trimmed}"`);
        return { ...cached, query, source: "cache" };
      }

      // 1) OpenDB primero: gratis e instantáneo. Requiere categoría.
      if (options?.category && this.openDbResolver) {
        const odb = await this.openDbResolver.resolve(trimmed, options.category);
        if (odb.mpns.length > 0) {
          const result: MpnResult = { ...odb, query };
          await this.cache.set(trimmed, result);
          this.logger.info(`Resuelto "${trimmed}" vía OpenDB → ${result.mpns.length} MPN(s)`);
          return result;
        }
      }

      // 2) Fallback: búsqueda web + LLM. La búsqueda usa el título limpio (sin
      // "Procesador", "hasta X GHz", etc.); el extractor y la caché usan la
      // query original.
      const searchQuery = cleanSearchQuery(trimmed);

      let results: SearchResult[] = [];
      let usedProvider = "";
      for (const provider of this.providers) {
        results = await provider.search(searchQuery, this.searchLimit);
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
 * Construye un `MpnFinder` con el stack por defecto: resolución OpenDB,
 * búsqueda web (Brave con DuckDuckGo de respaldo), extracción DeepSeek y caché
 * en Supabase. El cliente Supabase (service role) lo provee el consumidor.
 */
export function createMpnFinder(supabase: SupabaseClient): MpnFinder {
  return new MpnFinder({
    providers: [new BraveSearchProvider(), new DuckDuckGoProvider()],
    extractor: new DeepSeekExtractor(),
    cache: new SupabaseMpnCache(supabase),
    openDbResolver: new OpenDbResolver(supabase),
  });
}
