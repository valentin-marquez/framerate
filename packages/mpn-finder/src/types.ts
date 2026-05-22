/**
 * @module mpn-finder/types
 *
 * Contratos compartidos del servicio `mpn-finder` (Fase 2 del dedup de productos).
 *
 * El problema: distintas tiendas publican distinto identificador para el mismo
 * producto — unas el MPN del fabricante, otras sólo el EAN/código de barras —
 * así que no deduplican entre sí. Este servicio resuelve un producto
 * (título + identificador) a su **MPN canónico** vía búsqueda web + LLM, para
 * que el catálogo pueda unificarlo.
 *
 * Estos tipos son el contrato entre las 3 piezas del package (search providers,
 * extractor LLM, caché). NO modificar sin coordinar — todo depende de acá.
 */

/** Un resultado de búsqueda web: título + snippet + url. */
export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

/**
 * Proveedor de búsqueda web. Implementaciones previstas: DuckDuckGo (v0.1.0),
 * eBay Browse API, Brave Search. Pluggable: el orquestador los prueba en orden.
 */
export interface SearchProvider {
  /** Nombre del proveedor (para logs/telemetría). */
  readonly name: string;
  /**
   * Busca `query` y devuelve hasta `limit` resultados.
   * Debe ser tolerante a fallos: devolver `[]` si falla, nunca lanzar.
   */
  search(query: string, limit: number): Promise<SearchResult[]>;
}

/** Variante de empaque de un producto — distingue MPNs del mismo modelo. */
export type MpnVariant = "boxed" | "tray" | "oem" | "retail" | "unknown";

/** Un MPN candidato extraído, con su variante y confianza en [0, 1]. */
export interface MpnCandidate {
  value: string;
  variant: MpnVariant;
  confidence: number;
}

/** Resultado de resolver una query a su(s) MPN(s) canónico(s). */
export interface MpnResult {
  /** La query original con la que se pidió la resolución. */
  query: string;
  /** MPNs candidatos, ordenados por confianza descendente. `[]` si no se resolvió. */
  mpns: MpnCandidate[];
  /** Nombre canónico del producto, si se pudo determinar. */
  canonicalName: string | null;
  /** Notas del extractor (ambigüedad de variante, baja confianza, etc.). */
  notes: string | null;
  /** Origen del resultado: `"cache"`, `"<provider>+llm"`, o `"none"`. */
  source: string;
}

/**
 * Extractor LLM: dada la query original + los resultados de búsqueda, extrae
 * el/los MPN. Implementación v0.1.0: DeepSeek (JSON mode).
 */
export interface LlmExtractor {
  extract(query: string, results: SearchResult[]): Promise<MpnResult>;
}

/**
 * Caché de resoluciones MPN, keyed por la query normalizada. Resolver cuesta
 * una búsqueda web + una llamada LLM, así que se cachea agresivamente.
 * Las implementaciones deben ser tolerantes a fallos (un error de backend se
 * trata como cache-miss, nunca rompe el flujo).
 */
export interface MpnCache {
  /** Devuelve el resultado cacheado para `query`, o `null` si no hay / expiró. */
  get(query: string): Promise<MpnResult | null>;
  /** Persiste `result` para `query`. Un fallo se traga (no rompe el flujo). */
  set(query: string, result: MpnResult): Promise<void>;
}

/** Construye un `MpnResult` vacío (sin MPNs resueltos). */
export function emptyMpnResult(query: string, source = "none"): MpnResult {
  return { query, mpns: [], canonicalName: null, notes: null, source };
}
