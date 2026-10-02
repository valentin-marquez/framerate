import { createApp } from "@/app";
import type { Env } from "@/env";
import { receiveSupportEmail } from "@/features/support/support-inbound";

/**
 * Punto de entrada del Worker de la API: HTTP (catálogo público y administración) y el correo que Email Routing
 * entrega desde soporte@framerate.cl. El scraping vive en `apps/ingest` (Cron, Queue y RPC).
 */
const app = createApp();

export default {
  fetch: app.fetch,
  email: receiveSupportEmail,
} satisfies ExportedHandler<Env>;
