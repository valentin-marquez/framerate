import type { PipelineMessage } from "@framerate/contracts";

/** Bindings del Worker (ver `wrangler.jsonc`). */
export interface Env {
  DB: D1Database;
  AI: Ai;
  VERIFY_QUEUE: Queue<VerifyMessage>;
  MATCH_MODE: "shadow" | "reject" | "live";
  MATCH_DAILY_NEURONS: string;
  /** off: nada. shadow: cuenta los duplicados ya creados sin tocar nada. on: les abre revisión (#148). */
  MATCH_DETECT?: string;
  /** off: nada. shadow: Haiku opina sobre lo que queda pendiente sin decidir. live: su opinión decide (#149). */
  MATCH_HAIKU?: string;
  /** Secreto (`wrangler secret put`). Sin él, Haiku no se usa. */
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MONTHLY_USD?: string;
  ANTHROPIC_CYCLE_DAY?: string;
  /** Vínculo desde la identidad (#153). off: ignora la cola. shadow: sólo `match_shadow`. live: vincula y publica. */
  PIPELINE_LINK?: string;
}

/** Mensaje de `VERIFY_QUEUE`: verificar una revisión pendiente del Gatekeeper. */
export interface VerifyMessage {
  reviewId: number;
}

/** Mensaje de `framerate-link`: vincular una oferta ya normalizada. */
export type LinkMessage = PipelineMessage;
