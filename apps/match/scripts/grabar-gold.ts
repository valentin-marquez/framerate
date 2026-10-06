import gold from "../../ingest/src/features/ingestion/domain/match-gold.json";
import { judge, type Side } from "../src/judge";

// Regraba apps/match/test/gold-recorded.json (#133). Gasta ~2,5 neurons por par; el cupo gratis es 10.000 al día.
//   bunx wrangler dev -c scripts/wrangler.grabar.jsonc
//   curl "http://127.0.0.1:8797/?from=0&to=250" > /ruta/a.json ; curl ".../?from=250&to=500" > /ruta/b.json
//   jq -s 'add' /ruta/a.json /ruta/b.json > apps/match/test/gold-recorded.json
// Las entradas se indexan por posición en el gold; el test comprueba los títulos y avisa si hay que regrabar.
const side = (s: (typeof gold)[number]["a"]): Side => ({ title: s.rawTitle, brand: s.brand, mpn: s.mpn });

async function withRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (attempt >= 3) throw e;
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    return withRetry(fn, attempt + 1);
  }
}

export default {
  async fetch(req: Request, env: { AI: Ai }) {
    const q = new URL(req.url).searchParams;
    const from = Number(q.get("from") ?? 0);
    const to = Math.min(Number(q.get("to") ?? gold.length), gold.length);
    const out = [];
    for (let i = from; i < to; i++) {
      const a = side(gold[i].a);
      const b = side(gold[i].b);
      const j = await withRetry(() => judge(env.AI, a, b));
      out.push({ i, a: a.title, b: b.title, pAB: j.pAB, pBA: j.pBA });
    }
    return Response.json(out);
  },
};
