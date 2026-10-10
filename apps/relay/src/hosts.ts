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
];
