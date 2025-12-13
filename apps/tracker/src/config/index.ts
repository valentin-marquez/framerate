import { z } from "zod";

const envSchema = z.object({
	SUPABASE_URL: z.string().url(),
	SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
	PORT: z.coerce.number().default(3000),
});

export const config = envSchema.parse(process.env);
