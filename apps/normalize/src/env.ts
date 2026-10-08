import type { LinkMessage } from "@framerate/contracts";

/** Bindings del Worker (ver `wrangler.jsonc`). */
export interface Env {
  DB: D1Database;
  LINK_QUEUE: Queue<LinkMessage>;
  /** off: acusa sin llamar a Haiku. shadow y live normalizan igual; la sombra del vínculo la maneja match. */
  NORMALIZE_MODE?: string;
  /** Secreto (`wrangler secret put`). Sin él los mensajes esperan en la cola. */
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MONTHLY_USD?: string;
  ANTHROPIC_CYCLE_DAY?: string;
}
