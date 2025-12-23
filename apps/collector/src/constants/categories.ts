import { z } from "zod";

// 1. Single Source of Truth for categories
export const CATEGORY_VALUES = [
  "gpu",
  "cpu",
  "psu",
  "motherboard",
  "case",
  "ram",
  "hdd",
  "ssd",
  "case_fan",
  "cpu_cooler",
] as const;

// 2. Zod schema (runtime validation)
export const CategorySchema = z.enum(CATEGORY_VALUES);

// 3. TypeScript type inferred from Zod schema
export type Category = z.infer<typeof CategorySchema>;

// Helper generic for mapping a Category to some value
export type CategoryMap<T = string[]> = Record<Category, T>;
