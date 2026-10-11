/**
 * Dominios que el relay acepta descargar: sólo las tiendas con `egress: "relay"` en el registro de ingest
 * (`apps/ingest/src/features/ingestion/stores/registry.ts`); un test de ingest comprueba que coincidan. Sin esta lista,
 * un token filtrado convierte el servidor en un proxy abierto con la IP de la casa.
 */
export const RELAY_HOSTS: readonly string[] = [
  "tytgamer.cl",
  "www.tytgamer.cl",
  "www.tecnoshopping.cl",
  "www.winpy.cl",
  "www.megabytes.cl",
  "electronicabudini.cl",
  "globalbox.cl",
];

/**
 * Espera mínima entre peticiones a un dominio, sumando todas las corridas: dos categorías de Winpy en paralelo, cada
 * una a 6 s, eran 1 cada 3 s desde la misma IP y la tienda cortaba con 429 (~12 por minuto, 10-10-2026).
 */
export const HOST_INTERVAL_MS: Readonly<Record<string, number>> = {
  "www.winpy.cl": 6000,
};
