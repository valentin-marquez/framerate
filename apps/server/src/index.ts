import { createApp } from "@/app";
import type { Env } from "@/env";

/**
 * Punto de entrada del Worker de la API. Sólo atiende HTTP: catálogo público y
 * administración. El scraping vive en `apps/ingest` (Cron, Queue y RPC).
 */
const app = createApp();

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
