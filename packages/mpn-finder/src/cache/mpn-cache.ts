/**
 * @module mpn-finder/cache/mpn-cache
 *
 * Caché de resoluciones MPN respaldada por una tabla Postgres de Supabase
 * (`public.mpn_resolutions`). Resolver un MPN cuesta una búsqueda web + una
 * llamada LLM, así que se cachea agresivamente.
 *
 * Toda la clase es **tolerante a fallos**: si la tabla no existe todavía, hay
 * un error de red o el parseo del jsonb falla, `get` devuelve `null` (cache
 * miss) y `set` traga el error. El servicio debe seguir funcionando sin caché.
 */

import { createHash } from "node:crypto";
import { Logger } from "@framerate/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MpnCache, MpnResult } from "../types";

/** Nombre de la tabla que respalda la caché. */
const TABLE = "mpn_resolutions";

/** TTL por defecto de una entrada cacheada: 30 días, en milisegundos. */
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Fila tal como vive en `public.mpn_resolutions`. */
interface MpnResolutionRow {
  query_hash: string;
  query: string;
  result: unknown;
  expires_at: string | null;
}

/**
 * Caché de resoluciones MPN sobre Supabase Postgres.
 *
 * El cliente Supabase se **inyecta** por constructor: este package no decide
 * credenciales ni crea conexiones. El TTL es configurable (default 30 días).
 */
export class SupabaseMpnCache implements MpnCache {
  private readonly logger = new Logger("MpnCache");

  /**
   * @param client Cliente Supabase ya construido (service role en el collector).
   * @param ttlMs  Tiempo de vida de cada entrada, en ms. Default: 30 días.
   */
  constructor(
    private readonly client: SupabaseClient,
    private readonly ttlMs: number = DEFAULT_TTL_MS,
  ) {}

  /**
   * Normaliza la query (lowercase + trim) para que variaciones triviales de
   * mayúsculas/espacios compartan la misma entrada de caché.
   */
  private normalize(query: string): string {
    return query.toLowerCase().trim();
  }

  /** Calcula el `query_hash` (SHA-256 hex) de la query ya normalizada. */
  private hash(normalizedQuery: string): string {
    return createHash("sha256").update(normalizedQuery).digest("hex");
  }

  async get(query: string): Promise<MpnResult | null> {
    try {
      const queryHash = this.hash(this.normalize(query));

      const { data, error } = await this.client
        .from(TABLE)
        .select("query_hash, query, result, expires_at")
        .eq("query_hash", queryHash)
        .maybeSingle<MpnResolutionRow>();

      // Error de backend (tabla inexistente, red, etc.) → cache miss.
      if (error) {
        this.logger.warn(`get: error de backend, se trata como miss: ${error.message}`);
        return null;
      }

      // Fila inexistente → cache miss.
      if (!data) return null;

      // Entrada expirada → cache miss (no la borramos: el cleanup es aparte).
      if (data.expires_at !== null && new Date(data.expires_at).getTime() <= Date.now()) {
        return null;
      }

      // El jsonb `result` ya viene parseado por supabase-js; lo tipamos.
      return data.result as MpnResult;
    } catch (err) {
      // Cualquier fallo inesperado (parseo, etc.) → cache miss. Nunca lanza.
      this.logger.warn("get: fallo inesperado, se trata como miss", err);
      return null;
    }
  }

  async set(query: string, result: MpnResult): Promise<void> {
    try {
      const normalized = this.normalize(query);
      const queryHash = this.hash(normalized);
      const expiresAt = new Date(Date.now() + this.ttlMs).toISOString();

      const { error } = await this.client.from(TABLE).upsert(
        {
          query_hash: queryHash,
          query: normalized,
          result,
          expires_at: expiresAt,
        },
        { onConflict: "query_hash" },
      );

      // Un fallo de escritura se traga: la caché es best-effort.
      if (error) {
        this.logger.warn(`set: no se pudo persistir la entrada: ${error.message}`);
      }
    } catch (err) {
      // Cualquier fallo inesperado se traga. Nunca lanza.
      this.logger.warn("set: fallo inesperado al persistir", err);
    }
  }
}
