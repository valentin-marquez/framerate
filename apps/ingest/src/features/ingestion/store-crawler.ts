import { DurableObject } from "cloudflare:workers";
import type { Category } from "@framerate/contracts";
import { createDb } from "@framerate/database";
import { createLogger } from "@framerate/kit";
import type { Env } from "@/env";
import { enqueueCrawls, ensureSchedule, initSchema, nextWake, runAlarmStep, type Sql } from "./coordinator";
import { closeInterruptedRun } from "./ingestion.repository";
import { runCrawl, runRefresh, storeCategories } from "./runtime";
import type { StoreDefinition } from "./stores/adapter";
import { findStore } from "./stores/registry";

const log = createLogger({ service: "framerate-ingest" });

/**
 * Un Durable Object por tienda (#121): serializa sus corridas y lleva su agenda. Los RPC sólo escriben en SQLite y
 * programan la alarm; nunca crawlean, así un pedido que llega mientras la alarm espera a la tienda no la toca.
 */
export class StoreCrawler extends DurableObject<Env> {
  private readonly sql: Sql = (query, ...params) => this.ctx.storage.sql.exec(query, ...params).toArray() as never;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    initSchema(this.sql);
  }

  async enqueue(slug: string, categories: Category[], requestedBy: string): Promise<number> {
    this.ctx.storage.kv.put("slug", slug);
    const queued = enqueueCrawls(this.sql, categories, requestedBy, Date.now());
    await this.wakeAt(nextWake(this.sql, Date.now()));
    return queued;
  }

  /**
   * Red de seguridad del Cron horario: una alarm que agotó sus reintentos no vuelve sola. También adelanta la alarm si
   * apareció un slot antes (el primer refresco de un DO creado antes de la fase 2 esperaría al próximo crawl).
   */
  async ensureScheduled(slug: string): Promise<void> {
    this.ctx.storage.kv.put("slug", slug);
    ensureSchedule(this.sql, slug, Date.now(), Boolean(findStore(slug)?.adapter.refreshOffers));
    const current = await this.ctx.storage.getAlarm();
    const next = nextWake(this.sql, Date.now());
    if (current === null || (next !== null && next < current)) await this.wakeAt(next);
  }

  override async alarm() {
    // Un DO nunca llamado por RPC no tiene slug ni alarm; `ctx.id.name` no está garantizado dentro de la alarm.
    const slug = this.ctx.storage.kv.get<string>("slug");
    if (!slug) return;
    const found = findStore(slug);
    const store = found && !found.pausedReason ? found : null;
    const storeLog = log.child({ feature: "coordinator", store: slug });
    const db = createDb(this.env.DB);
    const wake = await runAlarmStep(this.sql, {
      slug,
      categories: store ? storeCategories(store) : null,
      now: Date.now,
      newId: () => crypto.randomUUID(),
      crawl: (category, runId) => runCrawl(this.env, store as StoreDefinition, category, log, runId),
      refresh: store?.adapter.refreshOffers ? (runId) => runRefresh(this.env, store, log, runId) : null,
      closeRun: (runId) => closeInterruptedRun(db, runId, new Date()),
      log: storeLog,
    });
    await this.wakeAt(wake);
  }

  private async wakeAt(at: number | null) {
    if (at === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(at);
  }
}
