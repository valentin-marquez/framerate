import { z } from "zod";
import { NORM_STATUSES } from "./pipeline";

/**
 * Estado de los sistemas para el personal (`GET /v1/admin/health`): qué falla o está atrasado, calculado al pedirlo
 * con lo que ya hay en la base. Es una consulta, no avisa: eso es aparte.
 */

export const HEALTH_SYSTEMS = [
  "scraping",
  "quarantine",
  "pipeline",
  "matching",
  "support",
  "moderation",
  "stores",
] as const;
export const HealthSystemSchema = z.enum(HEALTH_SYSTEMS);
export type HealthSystem = z.infer<typeof HealthSystemSchema>;

/**
 * Desde cuándo algo cuenta como atrasado: sin corrida exitosa, corriendo, esperando respuesta del personal, una
 * oferta en cola del pipeline o una oculta sin publicar (#153 §7).
 */
export const HEALTH_THRESHOLDS = {
  staleRunHours: 12,
  stuckRunMinutes: 30,
  waitingHours: 24,
  pendingHours: 2,
  hiddenHours: 24,
  /** Fracción del tope diario de IA a partir de la cual se avisa. */
  aiBudgetWarnRatio: 0.9,
} as const;

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

export const AI_PURPOSES = ["normalize", "judge", "extract"] as const;

/** Detalle del pipeline de normalización (#153 §7): el tablero es `SELECT norm_status, count(*)`. */
export const PipelineHealthSchema = z.object({
  byStatus: z.record(z.enum(NORM_STATUSES), z.number().int().nonnegative()),
  oldestPendingAt: z.iso.datetime().nullable(),
  /** Ofertas activas con `visible = 0`: todavía no pasaron el pipeline. */
  hidden: z.number().int().nonnegative(),
  oldestHiddenAt: z.iso.datetime().nullable(),
  /** Pausa global por falta de crédito (`pipeline_state.paused_until`). */
  pausedUntil: z.iso.datetime().nullable(),
  /** Gasto en modelos por propósito, desde `ai_usage`: hoy (UTC) y en el ciclo de facturación vigente. */
  aiUsage: z.array(
    z.object({
      purpose: z.enum(AI_PURPOSES),
      calls: z.number().int().nonnegative(),
      todayUsd: z.number().nonnegative(),
      cycleUsd: z.number().nonnegative(),
    }),
  ),
  cycleStart: z.iso.datetime(),
  /** Lo que hoy puede gastarse según el ciclo; null si el Worker no tiene tope configurado. */
  dailyCapUsd: z.number().nonnegative().nullable(),
});
export type PipelineHealth = z.infer<typeof PipelineHealthSchema>;

export const HealthSchema = z.object({
  generatedAt: z.iso.datetime(),
  systems: z.array(HealthSystemStatusSchema),
  /** Los errores primero y, dentro de cada gravedad, lo más viejo primero. */
  incidents: z.array(HealthIncidentSchema),
  pipeline: PipelineHealthSchema,
});
export type Health = z.infer<typeof HealthSchema>;
