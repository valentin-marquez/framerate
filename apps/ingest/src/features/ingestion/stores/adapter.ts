import type { Category } from "@framerate/contracts";
import type { Logger } from "@framerate/kit";
import type { RawOffer } from "../domain/normalize";
import type { HttpClient } from "./http";

/**
 * Contrato de una tienda. Cada tienda es código a medida (su HTML/API es único),
 * pero TODAS exponen esta misma forma, así el resto del sistema no sabe ni le
 * importa cómo se scrapea cada una.
 *
 * Reglas para implementar un adaptador:
 *  1. Sólo extrae y entrega datos crudos. No normaliza MPN, no deduce marcas,
 *     no decide nada: eso es de `normalize` y `matching`.
 *  2. Nunca inventa identificadores. Si la tienda no publica el MPN del
 *     fabricante, `mpn: null`. (El sistema anterior fabricaba "TIENDA-slug"
 *     y eso rompía el matching.)
 *  3. Guarda la respuesta cruda con `ctx.snapshot` para poder reprocesar
 *     sin volver a scrapear y depurar parsers con datos reales.
 *  4. Tiene fixtures y tests con respuestas reales guardadas.
 */
export interface StoreAdapter {
  /** Categorías que la tienda vende. Las que no aparecen no se crawlean. */
  readonly categories: Partial<Record<Category, readonly string[]>>;
  crawlCategory(category: Category, ctx: CrawlContext): AsyncIterable<RawOffer>;
}

export interface CrawlContext {
  http: HttpClient;
  log: Logger;
  /** Persiste una respuesta cruda (R2). `name` es relativo a la corrida. */
  snapshot(name: string, body: string): Promise<void>;
}

export interface StoreDefinition {
  slug: string;
  name: string;
  url: string;
  adapter: StoreAdapter;
}
