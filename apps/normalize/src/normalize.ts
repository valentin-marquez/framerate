import Anthropic from "@anthropic-ai/sdk";
import {
  CATEGORIES,
  type Category,
  type IdentityValue,
  type LinkMessage,
  NORMALIZER_VERSION,
  type PipelineMessage,
} from "@framerate/contracts";
import type { AiUsageTable, Db } from "@framerate/database";
import type { Logger } from "@framerate/kit";
import { catalogCandidates, listingIdentityFrom, mergeProductPair } from "@framerate/matching";
import {
  type Create,
  NORMALIZE_MODEL,
  type NormalizeCall,
  normalizeWithHaiku,
  type TokenUsage,
  usageUsd,
} from "@framerate/matching/normalize";
import { type Budget, budgetLeftUsd } from "./budget";
import { cpuReferences, modelKey, withReference } from "./cpu-reference";
import { fanKey, fanReferences, fillFromFanReference, pickFanReference } from "./fan-reference";
import { baseChipset, fillFromGpuReference, gpuReferences, pickGpuReference } from "./gpu-reference";
import { fillFromPartReference, PART_CATEGORIES, partKey, partReferences, pickPartReference } from "./part-reference";

/**
 * Consumidor de `framerate-normalize` (spec 2026-10-08 §1, §4 y §7): una oferta por mensaje, una llamada a Haiku por
 * (oferta, versión, hash), identidad anclada en `listing_identity`, gasto en `ai_usage` y el vínculo encolado.
 * Nada aquí reintenta por su cuenta: lo que no se pudo hacer vuelve a la cola con retraso y sin haber gastado.
 */

export interface NormalizeConfig extends Budget {
  mode: "off" | "shadow" | "live";
  /** null sin clave de Anthropic: los mensajes esperan. */
  create: Create | null;
}

export type Outcome =
  | { status: "off" | "skipped" | "normalized" | "failed" }
  | { status: "wait"; reason: string; delaySeconds: number };

export interface Context {
  now: Date;
  /** Entregas de este mensaje, la actual incluida (`message.attempts`). */
  attempts: number;
  log: Logger;
}

// Peor caso medido por oferta (ficha sin caché, dos llamadas): se reserva antes de preguntar.
const USD_PER_OFFER = 0.002;
const HOUR_S = 3600;
const RATE_LIMIT_DELAYS_S = [60, 300, 900];

const AI_ACTOR = `ai:${NORMALIZE_MODEL}`;
const isCategory = (c: string): c is Category => (CATEGORIES as readonly string[]).includes(c);
const wait = (reason: string, delaySeconds: number): Outcome => ({ status: "wait", reason, delaySeconds });

type UsageRow = Omit<AiUsageTable, "id">;

export async function normalizeListing(
  db: Db,
  link: Queue<LinkMessage>,
  message: PipelineMessage,
  config: NormalizeConfig,
  ctx: Context,
): Promise<Outcome> {
  const { now, attempts, log } = ctx;
  const { listingId, reason } = message;
  if (config.mode === "off") return { status: "off" };

  const listing = await db.query
    .selectFrom("listings as l")
    .innerJoin("stores as s", "s.id", "l.store_id")
    .select([
      "l.title",
      "l.store_id",
      "l.external_id",
      "l.url",
      "l.product_id",
      "l.raw_title",
      "l.brand",
      "l.mpn",
      "l.gtin",
      "l.category",
      "l.source_text",
      "l.norm_hash",
      "l.norm_status",
      "l.is_active",
      "s.name as store",
    ])
    .where("l.id", "=", listingId)
    .executeTakeFirst();
  // Una oferta que desapareció antes de normalizarse no vale la llamada (el backfill sí cubre las inactivas); sin
  // hash no hay idempotencia: lo encola de nuevo la corrida que lo calcule.
  if (!listing || !listing.norm_hash || (!listing.is_active && reason !== "backfill")) {
    log.info("normalize.skipped", { listingId, reason, found: Boolean(listing), hash: Boolean(listing?.norm_hash) });
    return { status: "skipped" };
  }
  const category = listing.category;
  const title = listing.raw_title ?? listing.title;
  if (!isCategory(category)) {
    log.error("normalize.unknown_category", { listingId, category, title });
    await markFailed(db, listingId, now);
    return { status: "failed" };
  }

  const existing = await db.query
    .selectFrom("listing_identity")
    .select("input_hash")
    .where("listing_id", "=", listingId)
    .where("version", "=", NORMALIZER_VERSION)
    .executeTakeFirst();
  if (existing?.input_hash === listing.norm_hash) {
    // Misma entrada y misma versión: no se paga dos veces. Si el vínculo no llegó a correr, se vuelve a pedir.
    if (listing.norm_status === "normalized") await link.send({ listingId, version: NORMALIZER_VERSION, reason });
    log.info("normalize.skipped", { listingId, reason, already: listing.norm_status });
    return { status: "skipped" };
  }

  const state = await db.query
    .selectFrom("pipeline_state")
    .select("paused_until")
    .where("id", "=", 1)
    .executeTakeFirst();
  if (state?.paused_until && state.paused_until > now.toISOString()) {
    const left = Math.ceil((Date.parse(state.paused_until) - now.getTime()) / 1000);
    return wait("paused", Math.min(HOUR_S, Math.max(60, left)));
  }
  if (!config.create) {
    log.error("normalize.no_api_key", { listingId });
    return wait("no_api_key", HOUR_S);
  }
  const budgetLeft = await budgetLeftUsd(db, config, now);
  if (budgetLeft < USD_PER_OFFER) {
    log.warn("normalize.budget_wait", { listingId, budgetLeft });
    return wait("budget", HOUR_S);
  }

  // Una fila de `ai_usage` por llamada real: el normalizador puede hacer hasta cuatro (reintento por JSON inválido,
  // cambio de categoría) y el libro tiene que cuadrar con la consola de Anthropic.
  const calls: { usage: TokenUsage; ms: number }[] = [];
  const create = config.create;
  const tracked: Create = async (params) => {
    const t0 = Date.now();
    const m = await create(params);
    calls.push({
      usage: {
        inputTokens: m.usage.input_tokens,
        outputTokens: m.usage.output_tokens,
        cacheReadTokens: m.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: m.usage.cache_creation_input_tokens ?? 0,
      },
      ms: Date.now() - t0,
    });
    return m;
  };
  const at = now.toISOString();
  const usageRow = (status: UsageRow["status"], error: string | null, call?: { usage: TokenUsage; ms: number }) => ({
    at,
    worker: "normalize" as const,
    purpose: "normalize" as const,
    model: NORMALIZE_MODEL,
    listing_id: listingId,
    review_id: null,
    input_tokens: call?.usage.inputTokens ?? 0,
    cache_read_tokens: call?.usage.cacheReadTokens ?? 0,
    cache_write_tokens: call?.usage.cacheWriteTokens ?? 0,
    output_tokens: call?.usage.outputTokens ?? 0,
    usd: call ? usageUsd(call.usage) : 0,
    ms: call?.ms ?? null,
    status,
    error,
  });

  const catalog = await catalogCandidates(db, {
    category,
    title,
    mpn: listing.mpn,
    gtin: listing.gtin,
    productId: listing.product_id,
  });
  const references = category === "cpu" ? await cpuReferences(db, title) : [];
  const gpus = category === "gpu" ? await gpuReferences(db, title) : [];
  const fans = category === "case_fan" ? await fanReferences(db, listing.brand) : [];
  const parts = await partReferences(db, category, listing.brand);
  const input = {
    category,
    title,
    brand: listing.brand,
    mpn: listing.mpn,
    gtin: listing.gtin,
    sourceText: listing.source_text,
    store: listing.store,
    catalog,
    knownModels:
      category === "gpu"
        ? [...new Set(gpus.map((r) => baseChipset(r.chipset)))]
        : category === "case_fan"
          ? [...new Set(fans.map((r) => r.family.toLowerCase()))]
          : PART_CATEGORIES.has(category)
            ? [...new Set(parts.map((r) => r.model.toLowerCase()))]
            : references.map((r) => r.model),
  };
  let result: NormalizeCall;
  try {
    result = await normalizeWithHaiku(tracked, input);
  } catch (error) {
    const status = classify(error);
    const text = error instanceof Error ? error.message : String(error);
    await db.query
      .insertInto("ai_usage")
      .values([...calls.map((c) => usageRow("ok", null, c)), usageRow(status, text.slice(0, 500))])
      .execute();
    if (status === "no_credit") {
      // Pausa global: sin crédito, cada llamada de cada consumidor fallaría igual.
      const pausedUntil = new Date(now.getTime() + HOUR_S * 1000).toISOString();
      await db.query
        .insertInto("pipeline_state")
        .values({ id: 1, paused_until: pausedUntil, updated_at: at })
        .onConflict((oc) => oc.column("id").doUpdateSet({ paused_until: pausedUntil, updated_at: at }))
        .execute();
      log.error("normalize.no_credit", { listingId, pausedUntil, error });
      return wait("no_credit", HOUR_S);
    }
    if (status === "rate_limited") {
      log.warn("normalize.rate_limited", { listingId, attempts });
      return wait("rate_limited", RATE_LIMIT_DELAYS_S[Math.min(attempts, 3) - 1] ?? 900);
    }
    log.error("normalize.api_error", { listingId, attempts, error });
    return wait("error", 60 * attempts);
  }

  // Las llamadas intermedias quedan `ok` (el libro mide gasto); el resultado de la oferta va en la última fila.
  const last = calls.length - 1;
  await db.query
    .insertInto("ai_usage")
    .values(calls.map((c, i) => usageRow(i === last ? result.status : "ok", i === last ? result.error : null, c)))
    .execute();
  log.info("normalize.called", {
    listingId,
    category: result.category,
    calls: result.calls,
    ...result.usage,
    usd: result.usd,
    ms: result.ms,
  });

  const output = result.output;
  if (result.status !== "ok" || !output) {
    log.warn(result.status === "refusal" ? "normalize.refused" : "normalize.invalid", {
      listingId,
      title,
      error: result.error,
    });
    await markFailed(db, listingId, now);
    return { status: "failed" };
  }
  const { identity, anchored } = listingIdentityFrom(output, {
    category,
    title,
    sourceText: listing.source_text,
    brand: listing.brand,
    mpn: listing.mpn,
  });
  if (!identity) {
    // `other`: accesorio, bundle o notebook. Sin identidad no hay vínculo y queda oculta; en `quarantine` se ve por qué
    // (#159), colgada de la última corrida de su tienda y categoría (`run_id` es obligatorio).
    log.warn("normalize.category_other", { listingId, title, reason: output.category_reason });
    const lastRun = await db.query
      .selectFrom("crawl_runs")
      .select("id")
      .where("store_id", "=", listing.store_id)
      .where("category", "=", category)
      .orderBy("started_at", "desc")
      .limit(1)
      .executeTakeFirst();
    await db.batch([
      ...(lastRun
        ? [
            db.query
              .insertInto("quarantine")
              .orIgnore()
              .values({
                run_id: lastRun.id,
                store_id: listing.store_id,
                external_id: listing.external_id,
                reason: "category:other",
                payload: JSON.stringify({ title, url: listing.url, category, reason: output.category_reason }),
                norm_hash: listing.norm_hash,
                created_at: at,
              }),
          ]
        : []),
      db.query.updateTable("listings").set({ norm_status: "failed", norm_at: at }).where("id", "=", listingId),
    ]);
    return { status: "failed" };
  }
  if (identity.category !== category) {
    log.info("normalize.category_changed", {
      listingId,
      from: category,
      to: identity.category,
      reason: output.category_reason,
    });
  }
  // Sólo vale un id que se le mostró: uno inventado o de otra categoría no llega a match.
  const shown = (id: string) => catalog.find((c) => String(c.id) === id)?.id ?? null;
  const sameAs = shown(output.same_as);
  const duplicates = sameAs
    ? [...new Set(output.duplicate_candidates.map(shown))].filter((id): id is number => id !== null && id !== sameAs)
    : [];
  log.info("normalize.anchored", {
    listingId,
    dropped: anchored.dropped,
    fromMpn: anchored.fromMpn,
    knowledge: anchored.knowledge,
    confidence: identity.confidence,
    candidates: catalog.length,
    sameAs,
  });

  const haikuSpecs: Record<string, IdentityValue> = {};
  const haikuSource: Record<string, string> = {};
  const fromKnowledge = new Set(output.specs_from_knowledge);
  for (const [field, value] of Object.entries(output.specs)) {
    if (value === null) continue;
    haikuSpecs[field] = value;
    haikuSource[field] = fromKnowledge.has(field) ? "knowledge" : "text";
  }
  // Si el modelo es uno de la ficha oficial (#179), sus specs reemplazan las de Haiku.
  const model = identity.category === "cpu" ? String(identity.identity.model ?? "") : "";
  const reference = model ? references.find((r) => modelKey(r.model) === modelKey(model)) : undefined;
  const cpuSpecs = withReference(haikuSpecs, haikuSource, reference, String(identity.identity.packaging ?? ""));
  // Tarjetas de video (#180): la referencia del chipset sólo completa, lo de la tienda gana.
  const gpu =
    identity.category === "gpu"
      ? pickGpuReference(gpus, String(identity.identity.chipset ?? ""), identity.identity.vram_gb)
      : undefined;
  const gpuSpecs = fillFromGpuReference(cpuSpecs.specs, cpuSpecs.source, gpu);
  // Ventiladores (#181): la ficha del fabricante completa ruido, presión, rodamiento e iluminación.
  const fanRefs =
    identity.category !== "case_fan"
      ? []
      : identity.brand && fanKey(identity.brand) !== fanKey(listing.brand ?? "")
        ? await fanReferences(db, identity.brand)
        : fans;
  const fan = pickFanReference(fanRefs, String(identity.identity.model ?? ""), identity.identity.size_mm);
  const fanSpecs = fillFromFanReference(gpuSpecs.specs, gpuSpecs.source, fan);
  // Coolers y gabinetes (#182): alto, radiador, sockets, largo de GPU, lo que usan las reglas de compatibilidad.
  const partRefs =
    !PART_CATEGORIES.has(identity.category) || identity.category !== category
      ? []
      : identity.brand && partKey(identity.brand) !== partKey(listing.brand ?? "")
        ? await partReferences(db, identity.category, identity.brand)
        : parts;
  const part = pickPartReference(partRefs, String(identity.identity.model ?? ""), identity.identity.radiator_mm);
  const { specs, source: specsSource } = fillFromPartReference(fanSpecs.specs, fanSpecs.source, part);
  const row = {
    listing_id: listingId,
    version: NORMALIZER_VERSION,
    input_hash: listing.norm_hash,
    model: NORMALIZE_MODEL,
    category: identity.category,
    brand: identity.brand,
    name: identity.name,
    mpn: identity.mpn,
    confidence: identity.confidence,
    identity: JSON.stringify(identity.identity),
    identity_raw: JSON.stringify({
      category: output.category,
      category_reason: output.category_reason,
      brand: output.brand,
      mpn: output.mpn,
      condition: output.condition,
      confidence: output.confidence,
      identity: output.identity,
      identity_from_mpn: output.identity_from_mpn,
      identity_from_knowledge: output.identity_from_knowledge,
      dropped: anchored.dropped,
      from_mpn: anchored.fromMpn,
      same_as: output.same_as,
      duplicate_candidates: output.duplicate_candidates,
      candidates: catalog.map((c) => c.id),
    }),
    specs: JSON.stringify(specs),
    specs_source: JSON.stringify(specsSource),
    same_as: sameAs,
    created_at: at,
  };
  await db.batch([
    db.query
      .insertInto("listing_identity")
      .values(row)
      .onConflict((oc) => oc.columns(["listing_id", "version"]).doUpdateSet(row)),
    db.query.updateTable("listings").set({ norm_status: "normalized", norm_at: at }).where("id", "=", listingId),
  ]);
  // Haiku vio dos fichas del mismo SKU entre los candidatos: se fusionan en la que eligió, salvo que un dato
  // estructural, un `forbid` o un rechazo previo lo frenen (`mergeBlocker`), o que las dos fichas tengan MPN y ninguno
  // en común (freno determinista aparte del juicio del modelo). Queda auditado en `match_decisions`.
  const mpnsOf = (id: number) => catalog.find((c) => c.id === id)?.mpns ?? [];
  for (const duplicate of duplicates) {
    const [a, b] = [mpnsOf(sameAs as number), mpnsOf(duplicate)];
    if (a.length > 0 && b.length > 0 && !a.some((m) => b.includes(m))) {
      log.info("normalize.duplicate", { listingId, sameAs, duplicate, status: "skipped", reason: "mpn_distinto" });
      continue;
    }
    const merged = await mergeProductPair(db, { a: sameAs as number, b: duplicate, decidedBy: AI_ACTOR, now: at });
    log.info("normalize.duplicate", { listingId, sameAs, duplicate, ...merged });
  }
  // Si esto falla, el reintento encuentra la identidad con el mismo hash y vuelve a encolar el vínculo sin pagar.
  await link.send({ listingId, version: NORMALIZER_VERSION, reason });
  return { status: "normalized" };
}

const markFailed = (db: Db, listingId: number, now: Date) =>
  db.query
    .updateTable("listings")
    .set({ norm_status: "failed", norm_at: now.toISOString() })
    .where("id", "=", listingId)
    .execute();

/** 429 → espera; 402/403 o 400 de crédito → pausa global; lo demás (5xx, red, clave) → reintento normal. */
function classify(error: unknown): "rate_limited" | "no_credit" | "error" {
  if (!(error instanceof Anthropic.APIError)) return "error";
  if (error.status === 429) return "rate_limited";
  if (error.status === 402 || error.status === 403) return "no_credit";
  if (error.status === 400 && /credit|billing/i.test(error.message)) return "no_credit";
  return "error";
}
