import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CORTEX_BATCH_SIZE: z.coerce.number().int().positive().default(6),
  CORTEX_POLL_INTERVAL_MS: z.coerce.number().int().nonnegative().default(2000),
  CORTEX_MAX_CONCURRENCY: z.coerce.number().int().positive().default(12),
  CORTEX_MAX_ATTEMPTS: z.coerce.number().int().nonnegative().default(3),
  CORTEX_BACKOFF_BASE_MS: z.coerce.number().int().nonnegative().default(2000),
  DEEPSEEK_API_KEY: z.string().min(1),
  AI_MODEL: z.string().optional().default("deepseek-chat"),
});

export const config = envSchema.parse(process.env);

export type Config = typeof config;
