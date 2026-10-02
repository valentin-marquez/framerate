import { z } from "zod";

/**
 * Estado de los sistemas para el personal (`GET /v1/admin/health`): qué falla o está atrasado, calculado al pedirlo
 * con lo que ya hay en la base. Es una consulta, no avisa: eso es aparte.
 */

export const HEALTH_SYSTEMS = ["scraping", "quarantine", "matching", "support", "moderation", "stores"] as const;
export const HealthSystemSchema = z.enum(HEALTH_SYSTEMS);
export type HealthSystem = z.infer<typeof HealthSystemSchema>;

/** Desde cuándo algo cuenta como atrasado: sin corrida exitosa, corriendo, o esperando respuesta del personal. */
export const HEALTH_THRESHOLDS = { staleRunHours: 12, stuckRunMinutes: 30, waitingHours: 24 } as const;

export const HealthIncidentSchema = z.object({
  /** Estable entre consultas (`scraping:alfa:gpu:failed`): la web lo usa de clave. */
  id: z.string(),
  system: HealthSystemSchema,
  /** error: algo roto ahora. warning: atrasado o esperando. */
  severity: z.enum(["error", "warning"]),
  title: z.string(),
  detail: z.string().nullable(),
  /** Desde cuándo pasa (inicio de la corrida, último mensaje, etc.). */
  at: z.iso.datetime(),
  /** Cuánto duró, si es una corrida terminada. */
  durationMs: z.number().int().nonnegative().nullable(),
  /** Página de la web que lo resuelve. */
  href: z.string(),
});
export type HealthIncident = z.infer<typeof HealthIncidentSchema>;

export const HealthSystemStatusSchema = z.object({
  id: HealthSystemSchema,
  /** La cifra de la tarjeta: tiendas seguidas, ofertas en cuarentena, pendientes… */
  value: z.number().int().nonnegative(),
  /** Incidencias de este sistema. */
  attention: z.number().int().nonnegative(),
  /** Sólo scraping: las últimas corridas, de la más antigua a la más nueva. */
  history: z.array(z.enum(["succeeded", "failed", "running"])).optional(),
});
export type HealthSystemStatus = z.infer<typeof HealthSystemStatusSchema>;

export const HealthSchema = z.object({
  generatedAt: z.iso.datetime(),
  systems: z.array(HealthSystemStatusSchema),
  /** Los errores primero y, dentro de cada gravedad, lo más viejo primero. */
  incidents: z.array(HealthIncidentSchema),
});
export type Health = z.infer<typeof HealthSchema>;
