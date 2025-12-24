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
  // Minimum age (ms) since last_scraped_at before a listing is eligible for re-scrape.
  // Listings with null last_scraped_at are always eligible. Default: 24 hours.
  LISTING_RESCRAPE_INTERVAL_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(24 * 60 * 60 * 1000),
  USER_AGENT_STRATEGY: z.enum(["random", "roundrobin"]).default("random"),
  USER_AGENT_LIST: z.string().optional(),
});

export const config = envSchema.parse(process.env);
