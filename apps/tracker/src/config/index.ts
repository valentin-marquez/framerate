import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  PUPPETEER_POOL_SIZE: z.coerce.number().int().positive().default(3),
  HEAVY_CONCURRENCY: z.coerce.number().int().positive().default(6),
  MEDIUM_CONCURRENCY: z.coerce.number().int().positive().default(15),
  LIGHT_CONCURRENCY: z.coerce.number().int().positive().default(30),
});

export const config = envSchema.parse(process.env);
