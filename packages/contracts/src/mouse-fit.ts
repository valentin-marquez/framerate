import { z } from "zod";

export const GRIPS = ["palm", "claw", "fingertip"] as const;
export const MOUSE_FITS = ["small", "right", "large"] as const;

/** Largo de la punta del dedo medio a la muñeca y ancho de los nudillos, en mm: 19 es alguien pensando en centímetros. */
export const HandSchema = z.object({
  length_mm: z.number().min(120).max(250),
  width_mm: z.number().min(60).max(130),
  grip: z.enum(GRIPS),
});
export type Hand = z.infer<typeof HandSchema>;

export const HandProfileResponseSchema = z.object({ hand: HandSchema.nullable() });

/** Caso de calibración (#218). Sin sesión exige Turnstile; nunca queda ligado a quien lo envía. */
export const MouseFitReportRequestSchema = HandSchema.extend({
  product_slug: z.string().trim().min(1).max(200),
  fit: z.enum(MOUSE_FITS),
  turnstileToken: z.string().max(2048).optional(),
});
export type MouseFitReportRequest = z.infer<typeof MouseFitReportRequestSchema>;

export interface MmRange {
  min: number;
  max: number;
}

// Punto de partida, de la regla de la comunidad: se cambian a mano revisando `mouse_fit_reports`, nunca solas.
const LENGTH_RATIO: Record<Hand["grip"], number> = { palm: 0.6, claw: 0.55, fingertip: 0.5 };
const LENGTH_MARGIN_MM = 8;
const WIDTH_RATIO = 0.65;
const WIDTH_MARGIN_MM = 6;

const around = (center: number, margin: number): MmRange => ({
  min: Math.round(center - margin),
  max: Math.round(center + margin),
});

export const mouseFit = (hand: Hand) => ({
  length: around(hand.length_mm * LENGTH_RATIO[hand.grip], LENGTH_MARGIN_MM),
  width: around(hand.width_mm * WIDTH_RATIO, WIDTH_MARGIN_MM),
});

/** `?fit_length=106-122`: rango en mm del catálogo de mouses. */
export const MmRangeParamSchema = z
  .string()
  .regex(/^\d{1,3}-\d{1,3}$/)
  .transform((v): MmRange => {
    const [min = 0, max = 0] = v.split("-").map(Number);
    return { min, max };
  })
  .refine((r) => r.min <= r.max, "El mínimo no puede superar al máximo");

export const mmRangeParam = (r: MmRange) => `${r.min}-${r.max}`;
