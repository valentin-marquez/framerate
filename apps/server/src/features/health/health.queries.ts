import {
  AI_PURPOSES,
  CATEGORY_LABELS,
  type Category,
  HEALTH_SYSTEMS,
  HEALTH_THRESHOLDS,
  type Health,
  type HealthIncident,
  NORM_STATUSES,
  type PipelineHealth,
} from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { sql } from "kysely";

/**
 * Estado de los sistemas para el personal, calculado al pedirlo con lo que ya hay en la base. Todas las lecturas van
 * en un solo viaje a D1; lo demás es derivar incidencias en memoria.
 */

const HOUR = 3_600_000;
const MINUTE = 60_000;
const HISTORY_RUNS = 40;
/** Una combinación tienda y categoría sin corridas en este tiempo ya no se sigue (la tienda dejó de crawlearse). */
const RUN_WINDOW_MS = 7 * 24 * HOUR;
const MAX_TICKET_INCIDENTS = 10;

const iso = (ms: number) => new Date(ms).toISOString();
const label = (category: string) => CATEGORY_LABELS[category as Category] ?? category;
const hours = (ms: number) => Math.floor(ms / HOUR);
const usd = (n: number) => `$${n.toFixed(2)}`;

/** Crédito de Anthropic que comparten normalize y match; `monthlyUsd` 0 = sin tope configurado. */
export interface AiBudget {
  monthlyUsd: number;
  /** Día del mes en que se renueva el crédito. */
  cycleDay: number;
}

/** Misma regla que `apps/match/src/haiku.ts` (las apps no se importan entre sí): ciclo UTC del día `cycleDay` al siguiente. */
export function billingCycle(now: Date, cycleDay: number) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const startMonth = now.getUTCDate() >= cycleDay ? m : m - 1;
  return { start: new Date(Date.UTC(y, startMonth, cycleDay)), end: new Date(Date.UTC(y, startMonth + 1, cycleDay)) };
}

/** Tope de hoy: lo que quedaba del ciclo al empezar el día, repartido entre los días que faltan (hoy incluido). */
function dailyCapUsd(now: Date, budget: AiBudget, spentBeforeToday: number): number {
  const { end } = billingCycle(now, budget.cycleDay);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysLeft = Math.max(1, Math.round((end.getTime() - today) / 86_400_000));
  return Math.max(0, budget.monthlyUsd - spentBeforeToday) / daysLeft;
}

export async function computeHealth(db: Db, budget: AiBudget, now = new Date()): Promise<Health> {
  const t = now.getTime();
  const waiting = t - HEALTH_THRESHOLDS.waitingHours * HOUR;
  const cycleStart = billingCycle(now, budget.cycleDay).start.toISOString();
  const dayStart = `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;

  const [
    latestRuns,
    history,
    [quarantine],
    [matching],
    openTickets,
    [reports],
    frozen,
    staleClaims,
    normStatuses,
    [hidden],
    [pipelineState],
    aiUsage,
  ] = await db.read([
    // La última corrida de cada tienda activa y categoría: es la que dice cómo está hoy.
    db.query
      .selectFrom("crawl_runs as r")
      .innerJoin("stores as s", "s.id", "r.store_id")
      .select(["s.slug", "s.name", "r.category", "r.status", "r.started_at", "r.finished_at", "r.error", "r.stats"])
      .where("s.is_active", "=", 1)
      .where("r.started_at", ">=", iso(t - RUN_WINDOW_MS))
      .where(
        sql<boolean>`r.started_at = (SELECT max(r2.started_at) FROM crawl_runs r2 WHERE r2.store_id = r.store_id AND r2.category = r.category)`,
      ),
    db.query.selectFrom("crawl_runs").select("status").orderBy("started_at", "desc").limit(HISTORY_RUNS),
    db.query
      .selectFrom("quarantine")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .where("created_at", ">=", iso(t - 24 * HOUR)),
    db.query
      .selectFrom("match_reviews")
      .select([sql<number>`count(*)`.as("n"), sql<string | null>`min(created_at)`.as("oldest")])
      .where("status", "=", "pending"),
    db.query
      .selectFrom("support_tickets")
      .select(["public_id", "subject", "last_message_at"])
      .where("status", "=", "open")
      .orderBy("last_message_at"),
    db.query
      .selectFrom("reports")
      .select([
        sql<number>`count(*)`.as("n"),
        sql<string | null>`min(CASE WHEN status = 'open' THEN created_at END)`.as("oldest_open"),
      ])
      .where("status", "in", ["open", "reviewing"]),
    db.query.selectFrom("stores").select(["slug", "name", "frozen_at"]).where("frozen_at", "is not", null),
    db.query
      .selectFrom("store_claims as c")
      .innerJoin("stores as s", "s.id", "c.store_id")
      .select(["s.slug", "s.name", "c.updated_at"])
      .where("c.status", "=", "stale"),
    // `updated_at` es cuándo la oferta entró en ese estado: quien cambia `norm_status` lo toca.
    db.query
      .selectFrom("listings")
      .select(["norm_status", sql<number>`count(*)`.as("n"), sql<string | null>`min(updated_at)`.as("oldest")])
      .where("is_active", "=", 1)
      .groupBy("norm_status"),
    db.query
      .selectFrom("listings")
      .select([sql<number>`count(*)`.as("n"), sql<string | null>`min(first_seen_at)`.as("oldest")])
      .where("visible", "=", 0)
      .where("is_active", "=", 1),
    db.query.selectFrom("pipeline_state").select(["paused_until", "updated_at"]).where("id", "=", 1),
    db.query
      .selectFrom("ai_usage")
      .select([
        "purpose",
        sql<number>`count(*)`.as("calls"),
        sql<number>`coalesce(sum(CASE WHEN at >= ${dayStart} THEN usd ELSE 0 END), 0)`.as("today_usd"),
        sql<number>`coalesce(sum(usd), 0)`.as("cycle_usd"),
      ])
      .where("at", ">=", cycleStart)
      .groupBy("purpose"),
  ]);

  const incidents: Record<(typeof HEALTH_SYSTEMS)[number], HealthIncident[]> = {
    scraping: [],
    quarantine: [],
    pipeline: [],
    matching: [],
    support: [],
    moderation: [],
    stores: [],
  };

  // Una tienda que falló y no volvió a correr (pausada en el registro, #81, #114) es una sola incidencia, no una por
  // categoría que se repite para siempre.
  const notCrawled = new Map<string, { name: string; at: string; error: string | null; categories: number }>();
  for (const r of latestRuns) {
    const base = { system: "scraping" as const, title: `${r.name}, ${label(r.category)}`, href: `/tiendas/${r.slug}` };
    const id = (kind: string) => `scraping:${r.slug}:${r.category}:${kind}`;
    const end = r.finished_at ?? r.started_at;
    if (r.status === "failed" && t - Date.parse(end) > HEALTH_THRESHOLDS.staleRunHours * HOUR) {
      const prev = notCrawled.get(r.slug);
      if (!prev || end > prev.at) notCrawled.set(r.slug, { name: r.name, at: end, error: r.error, categories: 0 });
      const entry = notCrawled.get(r.slug);
      if (entry) entry.categories++;
      continue;
    }
    if (r.status === "failed") {
      incidents.scraping.push({
        ...base,
        id: id("failed"),
        severity: "error",
        detail: r.error ? r.error.slice(0, 200) : null,
        at: end,
        durationMs: r.finished_at ? Date.parse(r.finished_at) - Date.parse(r.started_at) : null,
      });
    } else if (r.status === "running" && t - Date.parse(r.started_at) > HEALTH_THRESHOLDS.stuckRunMinutes * MINUTE) {
      incidents.scraping.push({
        ...base,
        id: id("stuck"),
        severity: "warning",
        detail: `Corriendo hace ${Math.floor((t - Date.parse(r.started_at)) / MINUTE)} min`,
        at: r.started_at,
        durationMs: null,
      });
    } else if (
      r.status === "succeeded" &&
      r.finished_at &&
      t - Date.parse(r.finished_at) > HEALTH_THRESHOLDS.staleRunHours * HOUR
    ) {
      incidents.scraping.push({
        ...base,
        id: id("stale"),
        severity: "warning",
        detail: `Sin corrida exitosa hace ${hours(t - Date.parse(r.finished_at))} h`,
        at: r.finished_at,
        durationMs: null,
      });
    } else if (r.status === "succeeded" && JSON.parse(r.stats).deactivationSkipped) {
      incidents.scraping.push({
        ...base,
        id: id("partial"),
        severity: "warning",
        detail: "Trajo menos de la mitad de las ofertas conocidas: no se desactivó nada",
        at: r.finished_at ?? r.started_at,
        durationMs: null,
      });
    }
  }

  for (const [slug, store] of notCrawled) {
    incidents.scraping.push({
      id: `scraping:${slug}:not-crawled`,
      system: "scraping",
      severity: "warning",
      title: store.name,
      detail: `No corre hace ${Math.floor((t - Date.parse(store.at)) / (24 * HOUR))} d (¿pausada?); su último error, en ${store.categories} categorías: ${(store.error ?? "sin detalle").slice(0, 160)}`,
      at: store.at,
      durationMs: null,
      href: `/tiendas/${slug}`,
    });
  }

  const byStatus = Object.fromEntries(NORM_STATUSES.map((s) => [s, 0])) as PipelineHealth["byStatus"];
  for (const row of normStatuses) byStatus[row.norm_status] = Number(row.n);
  const oldestPendingAt = normStatuses.find((r) => r.norm_status === "pending")?.oldest ?? null;
  const usage = AI_PURPOSES.map((purpose) => {
    const row = aiUsage.find((r) => r.purpose === purpose);
    return {
      purpose,
      calls: Number(row?.calls ?? 0),
      todayUsd: Number(row?.today_usd ?? 0),
      cycleUsd: Number(row?.cycle_usd ?? 0),
    };
  });
  const todayUsd = usage.reduce((sum, u) => sum + u.todayUsd, 0);
  const cycleUsd = usage.reduce((sum, u) => sum + u.cycleUsd, 0);
  const dailyCap = budget.monthlyUsd > 0 ? dailyCapUsd(now, budget, cycleUsd - todayUsd) : null;
  const pausedUntil = pipelineState?.paused_until ?? null;
  const pipelineHref = "/admin/estado?sistema=pipeline";

  if (byStatus.failed > 0) {
    incidents.pipeline.push({
      id: "pipeline:failed",
      system: "pipeline",
      severity: "warning",
      title: "Ofertas que Haiku no identificó",
      detail: `${byStatus.failed} no son un componente (combos, accesorios) o la respuesta salió inválida dos veces; se vuelven a intentar en cada corrida`,
      at: normStatuses.find((r) => r.norm_status === "failed")?.oldest ?? iso(t),
      durationMs: null,
      href: pipelineHref,
    });
  }
  if (pipelineState && pausedUntil && Date.parse(pausedUntil) > t) {
    incidents.pipeline.push({
      id: "pipeline:paused",
      system: "pipeline",
      severity: "error",
      title: "Pipeline en pausa: sin crédito de Anthropic",
      detail: `Hasta ${pausedUntil.slice(0, 16).replace("T", " ")} UTC`,
      at: pipelineState.updated_at,
      durationMs: null,
      href: pipelineHref,
    });
  }
  if (oldestPendingAt && t - Date.parse(oldestPendingAt) > HEALTH_THRESHOLDS.pendingHours * HOUR) {
    incidents.pipeline.push({
      id: "pipeline:pending",
      system: "pipeline",
      severity: "warning",
      title: "Ofertas en cola de normalización",
      detail: `${byStatus.pending} esperando, la más vieja hace ${hours(t - Date.parse(oldestPendingAt))} h`,
      at: oldestPendingAt,
      durationMs: null,
      href: pipelineHref,
    });
  }
  if (dailyCap !== null && todayUsd >= dailyCap * HEALTH_THRESHOLDS.aiBudgetWarnRatio) {
    incidents.pipeline.push({
      id: "pipeline:budget",
      system: "pipeline",
      severity: "warning",
      title: "Gasto de IA cerca del tope de hoy",
      detail: `${usd(todayUsd)} de ${usd(dailyCap)}; ${usd(cycleUsd)} en el ciclo`,
      at: dayStart,
      durationMs: null,
      href: pipelineHref,
    });
  }
  if (hidden?.oldest && t - Date.parse(hidden.oldest) > HEALTH_THRESHOLDS.hiddenHours * HOUR) {
    incidents.pipeline.push({
      id: "pipeline:hidden",
      system: "pipeline",
      severity: "warning",
      title: "Ofertas ocultas que no se publicaron a tiempo",
      detail: `${Number(hidden.n)} sin pasar el pipeline, la más vieja hace ${hours(t - Date.parse(hidden.oldest))} h`,
      at: hidden.oldest,
      durationMs: null,
      href: pipelineHref,
    });
  }

  if (matching?.oldest && Date.parse(matching.oldest) < waiting) {
    incidents.matching.push({
      id: "matching:pending",
      system: "matching",
      severity: "warning",
      title: "Revisiones de matching pendientes",
      detail: `${Number(matching.n)} esperando, la más vieja hace ${hours(t - Date.parse(matching.oldest))} h`,
      at: matching.oldest,
      durationMs: null,
      href: "/admin/gatekeeper",
    });
  }

  for (const ticket of openTickets
    .filter((x) => Date.parse(x.last_message_at) < waiting)
    .slice(0, MAX_TICKET_INCIDENTS)) {
    incidents.support.push({
      id: `support:${ticket.public_id}`,
      system: "support",
      severity: "warning",
      title: ticket.subject,
      detail: `Sin respuesta hace ${hours(t - Date.parse(ticket.last_message_at))} h`,
      at: ticket.last_message_at,
      durationMs: null,
      href: "/admin/support",
    });
  }

  if (reports?.oldest_open && Date.parse(reports.oldest_open) < waiting) {
    incidents.moderation.push({
      id: "moderation:reports",
      system: "moderation",
      severity: "warning",
      title: "Reportes sin revisar",
      detail: `${Number(reports.n)} abiertos, el más viejo hace ${hours(t - Date.parse(reports.oldest_open))} h`,
      at: reports.oldest_open,
      durationMs: null,
      href: "/admin/moderation",
    });
  }

  for (const store of frozen) {
    incidents.stores.push({
      id: `stores:${store.slug}:frozen`,
      system: "stores",
      severity: "error",
      title: store.name,
      detail: "Congelada: falló la verificación de su dominio",
      at: store.frozen_at ?? iso(t),
      durationMs: null,
      href: `/tiendas/${store.slug}`,
    });
  }
  for (const claim of staleClaims) {
    incidents.stores.push({
      id: `stores:${claim.slug}:stale-claim`,
      system: "stores",
      severity: "warning",
      title: claim.name,
      detail: "El reclamo no pasa la verificación del dominio",
      at: claim.updated_at,
      durationMs: null,
      href: `/tiendas/${claim.slug}`,
    });
  }

  const values: Record<(typeof HEALTH_SYSTEMS)[number], number> = {
    scraping: latestRuns.length,
    quarantine: Number(quarantine?.n ?? 0),
    // En camino: encoladas o con identidad a la espera del vínculo.
    pipeline: byStatus.pending + byStatus.normalized,
    matching: Number(matching?.n ?? 0),
    support: openTickets.length,
    moderation: Number(reports?.n ?? 0),
    stores: frozen.length + staleClaims.length,
  };

  return {
    generatedAt: now.toISOString(),
    systems: HEALTH_SYSTEMS.map((id) => ({
      id,
      value: values[id],
      attention: incidents[id].length,
      ...(id === "scraping" && { history: history.map((h) => h.status).reverse() }),
    })),
    incidents: HEALTH_SYSTEMS.flatMap((id) => incidents[id]).sort(
      (a, b) => Number(b.severity === "error") - Number(a.severity === "error") || Date.parse(a.at) - Date.parse(b.at),
    ),
    pipeline: {
      byStatus,
      oldestPendingAt,
      hidden: Number(hidden?.n ?? 0),
      oldestHiddenAt: hidden?.oldest ?? null,
      pausedUntil,
      aiUsage: usage,
      cycleStart,
      dailyCapUsd: dailyCap,
    },
  };
}
