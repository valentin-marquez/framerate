/** Bindings del Worker (ver `wrangler.jsonc`). */
export interface Env {
  DB: D1Database;
  AI: Ai;
  VERIFY_QUEUE: Queue<VerifyMessage>;
  MATCH_MODE: "shadow" | "live";
  MATCH_DAILY_NEURONS: string;
}

/** Mensaje de `VERIFY_QUEUE`: verificar una revisión pendiente del Gatekeeper. */
export interface VerifyMessage {
  reviewId: number;
}
