import type { z } from "zod";
import type {
  CaseFanSchema,
  CaseSchema,
  CpuCoolerSchema,
  CpuSchema,
  GpuSchema,
  HddSchema,
  MotherboardSchema,
  ProductSpecsSchema,
  PsuSchema,
  RamSchema,
  SsdSchema,
} from "./specs.schemas";

export type GpuSpecs = z.infer<typeof GpuSchema>;
export type CpuSpecs = z.infer<typeof CpuSchema>;
export type PsuSpecs = z.infer<typeof PsuSchema>;
export type MotherboardSpecs = z.infer<typeof MotherboardSchema>;
export type CaseSpecs = z.infer<typeof CaseSchema>;
export type RamSpecs = z.infer<typeof RamSchema>;
export type HddSpecs = z.infer<typeof HddSchema>;
export type SsdSpecs = z.infer<typeof SsdSchema>;
export type CaseFanSpecs = z.infer<typeof CaseFanSchema>;
export type CpuCoolerSpecs = z.infer<typeof CpuCoolerSchema>;

// Union type for all product specs
export type ProductSpecs = z.infer<typeof ProductSpecsSchema>;
