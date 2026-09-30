import { CategorySchema } from "@framerate/contracts";
import { z } from "zod";

/** Mensaje de la cola `CRAWL_QUEUE`: crawlear una categoría de una tienda. */
export const CrawlMessageSchema = z.object({
  type: z.literal("crawl.category"),
  store: z.string().min(1),
  category: CategorySchema,
  requestedAt: z.iso.datetime(),
  requestedBy: z.string().default("cron"),
});
export type CrawlMessage = z.infer<typeof CrawlMessageSchema>;
