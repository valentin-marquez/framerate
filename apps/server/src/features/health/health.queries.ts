import {
  CATEGORY_LABELS,
  type Category,
  HEALTH_SYSTEMS,
  HEALTH_THRESHOLDS,
  type Health,
  type HealthIncident,
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

export async function computeHealth(db: Db, now = new Date()): Promise<Health> {
  const t = now.getTime();
  const waiting = t - HEALTH_THRESHOLDS.waitingHours * HOUR;

  const [latestRuns, history, [quarantine], [matching], openTickets, [reports], frozen, staleClaims] = await db.read([
    // La última corrida de cada tienda activa y categoría: es la que dice cómo está hoy.
    db.query
      .selectFrom("crawl_runs as r")
      .innerJoin("stores as s", "s.id", "r.store_id")
      .select(["s.slug", "s.name", "r.category", "r.status", "r.started_at", "r.finished_at", "r.error"])
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
  ]);

  const incidents: Record<(typeof HEALTH_SYSTEMS)[number], HealthIncident[]> = {
    scraping: [],
    quarantine: [],
    matching: [],
    support: [],
    moderation: [],
    stores: [],
  };

  for (const r of latestRuns) {
    const base = { system: "scraping" as const, title: `${r.name}, ${label(r.category)}`, href: `/tiendas/${r.slug}` };
    const id = (kind: string) => `scraping:${r.slug}:${r.category}:${kind}`;
    if (r.status === "failed") {
      const end = r.finished_at ?? r.started_at;
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
    }
  }

  if (matching && matching.oldest && Date.parse(matching.oldest) < waiting) {
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

  if (reports && reports.oldest_open && Date.parse(reports.oldest_open) < waiting) {
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
  };
}
