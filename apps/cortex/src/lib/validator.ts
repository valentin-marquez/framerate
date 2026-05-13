import { type OpenDBProduct, OpenDBProductSchema } from "@framerate/opendb";
import logger from "@/logger";

/**
 * Validates a product object against the OpenDB schema.
 * Returns the validated object if successful, or null if validation fails (logging errors).
 */
export function validateOpenDBProduct(data: unknown): OpenDBProduct | null {
  const result = OpenDBProductSchema.safeParse(data);

  if (!result.success) {
    logger.warn("OpenDB Product Validation Failed:", result.error.format());
    return null;
  }

  return result.data;
}

/**
 * Partial validation for cases where we might only have specs or partial data.
 * Useful for pipeline stages where full product isn't assembled yet.
 */
export function validatePartialOpenDBProduct(data: unknown): Partial<OpenDBProduct> | null {
  const result = OpenDBProductSchema.partial().safeParse(data);

  if (!result.success) {
    logger.warn("Partial OpenDB Product Validation Failed:", result.error.format());
    return null;
  }

  return result.data;
}
