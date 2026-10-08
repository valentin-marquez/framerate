/** Bindings del Worker (ver `wrangler.jsonc`). */
export interface Env {
  DB: D1Database;
  AI: Ai;
  VERIFY_QUEUE: Queue<VerifyMessage>;
  MATCH_MODE: "shadow" | "reject" | "live";
  MATCH_DAILY_NEURONS: string;
  /** off: nada. shadow: cuenta los duplicados ya creados sin tocar nada. on: les abre revisión (#148). */
  MATCH_DETECT?: string;
}

/** Mensaje de `VERIFY_QUEUE`: verificar una revisión pendiente del Gatekeeper. */
export interface VerifyMessage {
  reviewId: number;
}
