import { z } from "zod";

/**
 * `POST /v1/clicks`: clic saliente hacia una tienda. Sin sesión obligatoria y sin cuerpo en la respuesta (204).
 * `source` es también el `utm_campaign` del link. La tienda sale del `listing_id` o, en la página de una tienda, de
 * `store_id` (id o slug). `target_url` se valida pero no se guarda.
 */

export const ClickSourceSchema = z.enum([
  "product_details_hero",
  "product_details_comparison",
  "product_details_mobile",
  "quote_item",
  "quote_pdf",
  "store_page",
]);
export type ClickSource = z.infer<typeof ClickSourceSchema>;

const ClickRefSchema = z.string().trim().min(1).max(64).nullish();

export const RecordClickRequestSchema = z.object({
  source: ClickSourceSchema,
  target_url: z.url().max(2048),
  referrer_path: z.string().max(512).nullish(),
  listing_id: ClickRefSchema,
  store_id: ClickRefSchema,
});
export type RecordClickRequest = z.infer<typeof RecordClickRequestSchema>;
