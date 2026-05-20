/**
 * Worker de re-verificación periódica de claims de tiendas.
 *
 * Cada 6 horas (configurable) consulta el RPC `claims_due_for_recheck`
 * que retorna hasta 200 claims con status `verified|stale` y cuyo
 * `last_checked_at` quedó atrás del grace period.
 *
 * Para cada claim hace resolución DoH en paralelo contra Cloudflare + Google
 * y llama al RPC atómico `process_recheck_result` que:
 *   - actualiza `last_checked_at` y el contador `consecutive_failures`,
 *   - tras 3 fallos consecutivos: status = `stale` y congela la tienda
 *     (`stores.frozen_at = now()`),
 *   - en éxito: limpia `frozen_at` y `last_error`,
 *   - escribe en `claim_audit_log`.
 *
 * Concurrencia: chunks de 10 con Promise.allSettled para no saturar los
 * resolvers DoH públicos (tienen rate limits gratuitos).
 */

import { Logger } from "@framerate/utils";
import { supabase } from "@/db";
import { verifyTxtRecord } from "@/lib/doh";

interface ClaimDueRow {
  id: string;
  store_id: string | null;
  claimed_domain: string;
  txt_record_name: string;
  verification_token: string;
  status: string;
  last_checked_at: string | null;
  last_error: string | null;
  verified_at: string | null;
  expires_at: string;
  created_at: string;
  attempts: number;
}

export interface ClaimRecheckerOptions {
  /** Intervalo entre pasadas (ms). Default 6h. */
  intervalMs?: number;
  /** Grace period que recibe el RPC (interval Postgres). Default 6 horas. */
  graceInterval?: string;
  /** Tamaño de chunk paralelo para procesar DoH. Default 10. */
  chunkSize?: number;
  /** Máximo de fallos consecutivos antes de congelar. Default 3. */
  maxFailures?: number;
}

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h
const DEFAULT_GRACE = "06:00:00"; // 6h (formato hh:mm:ss seguro para postgres interval)
const DEFAULT_CHUNK_SIZE = 10;
const DEFAULT_MAX_FAILURES = 3;

const logger = new Logger("ClaimRechecker");

export function startClaimRechecker(opts: ClaimRecheckerOptions = {}): { stop: () => void } {
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const grace = opts.graceInterval ?? DEFAULT_GRACE;
  const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const maxFailures = opts.maxFailures ?? DEFAULT_MAX_FAILURES;

  let timer: ReturnType<typeof setInterval> | null = null;
  let inflight = false;

  const tick = async () => {
    if (inflight) {
      logger.warn("tick previo aún en curso, salteando esta ronda");
      return;
    }
    inflight = true;
    try {
      await runOnce({ grace, chunkSize, maxFailures });
    } catch (err) {
      logger.error("Error en pasada de recheck:", err);
    } finally {
      inflight = false;
    }
  };

  logger.info(
    `Iniciado. interval=${Math.round(intervalMs / 1000)}s grace=${grace} chunk=${chunkSize} maxFailures=${maxFailures}`,
  );

  // Tick inicial (no espera el primer intervalo)
  void tick();

  timer = setInterval(() => {
    void tick();
  }, intervalMs);

  return {
    stop: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
        logger.info("Detenido.");
      }
    },
  };
}

interface RunOpts {
  grace: string;
  chunkSize: number;
  maxFailures: number;
}

async function runOnce({ grace, chunkSize, maxFailures }: RunOpts): Promise<void> {
  const startedAt = Date.now();

  const { data, error } = await supabase.rpc("claims_due_for_recheck", { p_grace: grace });

  if (error) {
    logger.error("RPC claims_due_for_recheck falló:", error.message ?? error);
    return;
  }

  const claims = (Array.isArray(data) ? data : []) as ClaimDueRow[];

  if (claims.length === 0) {
    logger.info("No hay claims por re-verificar.");
    return;
  }

  logger.info(`Re-verificando ${claims.length} claim(s)…`);

  let verified = 0;
  let staled = 0;
  let unchanged = 0;
  let errored = 0;

  for (let i = 0; i < claims.length; i += chunkSize) {
    const slice = claims.slice(i, i + chunkSize);
    const results = await Promise.allSettled(slice.map((c) => processClaim(c, maxFailures)));
    for (const r of results) {
      if (r.status === "rejected") {
        errored += 1;
        continue;
      }
      switch (r.value) {
        case "verified":
          verified += 1;
          break;
        case "staled":
          staled += 1;
          break;
        case "unchanged":
          unchanged += 1;
          break;
        case "errored":
          errored += 1;
          break;
      }
    }
  }

  const elapsed = Date.now() - startedAt;
  logger.info(
    `Pasada completa en ${elapsed}ms. verified=${verified} staled=${staled} unchanged=${unchanged} errored=${errored}`,
  );
}

type ProcessOutcome = "verified" | "staled" | "unchanged" | "errored";

async function processClaim(claim: ClaimDueRow, maxFailures: number): Promise<ProcessOutcome> {
  const previousStatus = claim.status;

  let dnsResult: Awaited<ReturnType<typeof verifyTxtRecord>>;
  try {
    dnsResult = await verifyTxtRecord(claim.txt_record_name, claim.verification_token);
  } catch (err) {
    logger.error(`DoH falló para claim ${claim.id} (${claim.claimed_domain}):`, err);
    return "errored";
  }

  const matched = dnsResult.matched;

  // No logueamos el token TXT — sólo el meta para diagnóstico.
  const dnsDetails = {
    domain: claim.claimed_domain,
    record: claim.txt_record_name,
    status: dnsResult.status,
    cloudflare: {
      ok: dnsResult.details.cloudflare.ok,
      status: dnsResult.details.cloudflare.status,
      record_count: dnsResult.details.cloudflare.records.length,
    },
    google: {
      ok: dnsResult.details.google.ok,
      status: dnsResult.details.google.status,
      record_count: dnsResult.details.google.records.length,
    },
    checked_at: new Date().toISOString(),
  };

  // biome-ignore lint/suspicious/noExplicitAny: RPC creada en migración 20260520; los types se regeneran post-deploy.
  const { error } = await (supabase as any).rpc("process_recheck_result", {
    p_claim_id: claim.id,
    p_matched: matched,
    p_dns_details: dnsDetails,
    p_max_failures: maxFailures,
  });

  if (error) {
    logger.error(
      `RPC process_recheck_result falló para claim ${claim.id} (${claim.claimed_domain}):`,
      error.message ?? error,
    );
    return "errored";
  }

  if (matched) {
    if (previousStatus === "stale") {
      logger.info(`claim ${claim.id} (${claim.claimed_domain}) recuperado: stale → verified (store descongelada)`);
    } else {
      logger.info(`claim ${claim.id} (${claim.claimed_domain}) sigue verified.`);
    }
    return previousStatus === "stale" ? "verified" : "unchanged";
  }

  // No matched. El RPC decide si pasa a stale tras maxFailures.
  logger.warn(
    `claim ${claim.id} (${claim.claimed_domain}) DoH falló (status=${dnsResult.status}). Previo=${previousStatus}.`,
  );
  return previousStatus === "verified" ? "staled" : "unchanged";
}
