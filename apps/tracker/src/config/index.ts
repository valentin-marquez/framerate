import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  PUPPETEER_POOL_SIZE: z.coerce.number().int().positive().default(3),
  HEAVY_CONCURRENCY: z.coerce.number().int().positive().default(6),
  MEDIUM_CONCURRENCY: z.coerce.number().int().positive().default(15),
  LIGHT_CONCURRENCY: z.coerce.number().int().positive().default(30),
  // Rate limiting per domain (ms)
  RATE_DELAY_HEAVY_MS: z.coerce.number().int().nonnegative().default(1000),
  RATE_DELAY_MEDIUM_MS: z.coerce.number().int().nonnegative().default(500),
  RATE_DELAY_LIGHT_MS: z.coerce.number().int().nonnegative().default(200),
  // Edad mínima (ms) desde last_scraped_at antes de que un anuncio sea elegible para volver a ser scrapeado.
  // Los anuncios con last_scraped_at en null siempre son elegibles.
  // Nota: los anuncios con `is_active = false` serán siempre elegibles para re-procesado.
  // Por defecto: 2 horas.
  LISTING_RESCRAPE_INTERVAL_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(2 * 60 * 60 * 1000),
  USER_AGENT_STRATEGY: z.enum(["random", "roundrobin"]).default("random"),
  USER_AGENT_LIST: z.string().optional(),
});

export const config = envSchema.parse(process.env);
