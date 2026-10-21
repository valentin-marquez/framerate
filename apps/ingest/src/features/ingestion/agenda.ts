/** Cuándo corre cada tienda (#201): lógica pura del coordinador, sin runtime del Durable Object. */

export const CRAWL_PERIOD_MS = 6 * 60 * 60_000;
/** Tras el tercer intento fallido la tarea se descarta; el slot siguiente la vuelve a crear. */
export const MAX_ATTEMPTS = 3;

/** Desfase estable de la tienda dentro del período (FNV-1a del slug), al minuto: reparte las tiendas en las 6 h. */
export function storeOffset(slug: string, period: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash % Math.floor(period / 60_000)) * 60_000;
}

/** El próximo instante `>= now` de la forma `k * period + offset`. */
export function nextSlot(now: number, period: number, offset: number): number {
  return Math.ceil((now - offset) / period) * period + offset;
}

/** Igual que la cola de antes: 5 min por intento. */
export function retryDelay(attempts: number): number {
  return 5 * 60_000 * attempts;
}
