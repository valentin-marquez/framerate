
Cortex — trabajador en segundo plano que procesa `ai_extraction_jobs` desde Supabase y llama a LLMs para extraer especificaciones.

Uso

- Configura las variables de entorno: `SUPABASE_URL`, `SUPABASE_KEY` (service role), opcional `CORTEX_BATCH_SIZE`, `CORTEX_POLL_INTERVAL_MS`.
- Desarrollo: `bun run dev`
- Producción: `bun start`

Notas

- Esto es un andamiaje mínimo. `src/worker.ts` actualmente escribe un `result` de ejemplo y marca los trabajos como completados. Reemplaza con estrategias + cliente LLM cuando esté listo.

### Integración de colas en PostgreSQL

No contamos con Redis, por lo que utilizamos PostgreSQL como sistema de colas para los trabajos de extracción de especificaciones. Esto se implementa mediante la migración [`packages/db/supabase/migrations/20251219090000_add_ai_extraction_jobs.sql`](../../../../packages/db/supabase/migrations/20251219090000_add_ai_extraction_jobs.sql), que crea la tabla y lógica necesarias para manejar los `ai_extraction_jobs` directamente en la base de datos. Esta estrategia es viable para extraer specs usando Deepseek y simplifica la infraestructura al aprovechar la base de datos existente.
