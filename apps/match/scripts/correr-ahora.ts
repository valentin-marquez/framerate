import { createDb } from "@framerate/database";
import { createLogger } from "@framerate/kit";
import { proposeDuplicateReviews } from "../src/detect";
import { neuronsSpentSince } from "../src/reviews.repository";
import { reviewsForToday, verifyReview } from "../src/verify";

// Corre a mano lo que hace el cron de framerate-match, contra los bindings reales, para no esperar a las :47.
// Las colas no andan en `wrangler dev --remote`, así que juzga en tandas en vez de encolar.
//   bunx wrangler dev --remote -c scripts/wrangler.correr.jsonc
//   curl "http://127.0.0.1:8795/?paso=preparar"      # extrae modelos y propone duplicados
//   curl "http://127.0.0.1:8795/?paso=juzgar&n=40"   # juzga 40 pendientes (repetir)
const log = createLogger({ feature: "match-correr" });

export default {
  async fetch(req: Request, env: { DB: D1Database; AI: Ai }) {
    const q = new URL(req.url).searchParams;
    const dailyNeurons = Number(q.get("neurons") ?? 8000);
    const db = createDb(env.DB);
    const now = new Date();
    const startOfDay = `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
    const out: string[] = [];
    const gastado = await neuronsSpentSince(db, startOfDay);
    out.push(`gastado hoy: ${gastado.toFixed(1)} neurons de ${dailyNeurons}`);

    if (q.get("paso") === "juzgar") {
      const n = Number(q.get("n") ?? 40);
      const ids = (await reviewsForToday(db, { mode: "live", dailyNeurons }, new Date())).slice(0, n);
      const outcomes: Record<string, number> = {};
      for (const id of ids) {
        const r = await verifyReview(db, env.AI, id, { mode: "live", dailyNeurons }, new Date(), log);
        outcomes[String(r)] = (outcomes[String(r)] ?? 0) + 1;
      }
      out.push(`juzgadas ${ids.length}: ${JSON.stringify(outcomes)}`);
      return new Response(out.join("\n"));
    }

    const found = await proposeDuplicateReviews(db, { now: new Date() });
    out.push(`detector: ${found.proposed} revisiones nuevas de ${found.evaluated} ofertas evaluadas`);
    out.push(`  descartadas: ${JSON.stringify(found.skipped)}`);
    for (const s of found.samples.slice(0, 8)) out.push(`  ${s.score.toFixed(2)} ${s.title.slice(0, 58)}`);
    return new Response(out.join("\n"));
  },
};
