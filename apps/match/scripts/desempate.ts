import type { Category } from "@framerate/contracts";
import { buildFingerprint } from "@framerate/matching";
import { judge } from "../src/judge";

// Compara tres formas de desempatar los pares donde Gemma se contradice según el orden (#148): con los atributos
// como contexto, con Clef de segunda opinión, y con Clef mirando las dos fotos.
//   bunx wrangler dev --remote -c scripts/wrangler.desempate.jsonc
//   curl "http://127.0.0.1:8794/?m=contexto,clef,fotos" -d @pares.json
const CLEF_PRICE = 21818 / 1e6;

const REGLAS =
  "Decide whether the two listings sell the exact same retail product (same SKU). Spanish-language titles from " +
  "Chilean stores. Ignore store wording: marketing phrases, shipping notes, intended use, packaging and word order. " +
  "Different means a conflict in any of: model or model suffix (X3D, Super, Ti, XT, GM, M, CSM, MLG), revision " +
  "(R2, V2, AC), capacity, memory generation (DDR4/DDR5), ECC or not, SO-DIMM or DIMM, kit size, color, RGB or " +
  "not, edition. If both listings share the same manufacturer part number, they are the same product.";

const FOTOS =
  "The two images show one product each, in the same order as the two listings. Decide whether both listings sell " +
  "the exact same retail product. Use the images to settle differences in color, size, included fans, bundle or " +
  "physical variant that the titles do not state. Ignore the background, the angle and the photo quality.";

interface Par {
  id: number;
  label: "same" | "different";
  cat: string;
  ta: string;
  ba: string;
  ma: string;
  ia: string;
  tb: string;
  bb: string;
  kb: string;
}

const side = (title: string, brand: string, mpn: string) => ({ title, brand: brand || null, mpn: mpn || null });

/** Los atributos que el matching ya sabe de cada lado, como contexto para el modelo. */
function withAttributes(p: Par, title: string, brand: string, mpn: string) {
  const fp = buildFingerprint({ category: p.cat as Category, title, brand: brand || null, mpn: mpn || null });
  return { title, brand: fp.brand, mpn: fp.mpn, attributes: fp.attributes };
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function clef(ai: Ai, state: unknown, instructions: string, images?: Uint8Array[]) {
  const body: Record<string, unknown> = { state, questions: { r: { type: "noul", instructions } } };
  // El esquema pide {content_type, base64}; ni URLs remotas ni arreglos de bytes.
  if (images?.length) body.images = images.map((b) => ({ content_type: "image/webp", base64: toBase64(b) }));
  const r = (await ai.run("@cf/cloudflare/clef" as never, body as never)) as {
    answers?: Record<string, { noul?: number }>;
    usage?: { input_tokens?: number };
  };
  return { p: r.answers?.r?.noul ?? 0.5, neurons: (r.usage?.input_tokens ?? 400) * CLEF_PRICE };
}

async function bytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export default {
  async fetch(req: Request, env: { AI: Ai }) {
    const metodos = (new URL(req.url).searchParams.get("m") ?? "contexto,clef,fotos").split(",");
    const pares = (await req.json()) as Par[];
    const out: string[] = [];

    for (const metodo of metodos) {
      const res: Array<{ p: Par; lo: number; hi: number }> = [];
      let neurons = 0;
      let fallos = 0;
      for (const p of pares) {
        try {
          if (metodo === "contexto") {
            const a = withAttributes(p, p.ta, p.ba, p.ma);
            const b = withAttributes(p, p.tb, p.bb, "");
            const x = await judge(env.AI, a as never, b as never);
            neurons += x.neurons;
            res.push({ p, lo: Math.min(x.pAB, x.pBA), hi: Math.max(x.pAB, x.pBA) });
          } else if (metodo === "clef") {
            const a = side(p.ta, p.ba, p.ma);
            const b = side(p.tb, p.bb, "");
            const x = await clef(env.AI, { a, b }, REGLAS);
            const y = await clef(env.AI, { a: b, b: a }, REGLAS);
            neurons += x.neurons + y.neurons;
            res.push({ p, lo: Math.min(x.p, y.p), hi: Math.max(x.p, y.p) });
          } else if (metodo === "fotos") {
            const [ia, ib] = await Promise.all([bytes(p.ia), bytes(`https://cdn.framerate.cl/${p.kb}`)]);
            if (!ia || !ib) {
              fallos++;
              continue;
            }
            const state = { a: side(p.ta, p.ba, p.ma), b: side(p.tb, p.bb, "") };
            const x = await clef(env.AI, state, FOTOS, [ia, ib]);
            neurons += x.neurons;
            res.push({ p, lo: x.p, hi: x.p });
          }
        } catch (e) {
          fallos++;
          out.push(`  error en ${p.id}: ${String(e).slice(0, 120)}`);
        }
      }
      const same = res.filter((r) => r.p.label === "same");
      const diff = res.filter((r) => r.p.label === "different");
      out.push(
        `== ${metodo}: ${res.length} pares, ${(neurons / Math.max(res.length, 1)).toFixed(1)} neurons por par, ${fallos} fallos`,
      );
      for (const t of [0.9, 0.8, 0.7]) {
        const ok = same.filter((r) => r.lo >= t).length;
        const mal = diff.filter((r) => r.lo >= t);
        out.push(
          `   umbral ${t} en los dos órdenes: resuelve ${ok}/${same.length} iguales, fusiones erróneas ${mal.length}/${diff.length} [${mal.map((r) => r.p.id).join(" ")}]`,
        );
      }
      const malAlto = diff.filter((r) => r.hi >= 0.9);
      out.push(`   distintos donde algún orden dice 0,9 o más: ${malAlto.map((r) => r.p.id).join(" ") || "ninguno"}`);
      for (const r of res.slice(0, 6))
        out.push(`   ${r.p.id} ${r.p.label.padEnd(9)} ${r.lo.toFixed(2)}/${r.hi.toFixed(2)}`);
    }
    return new Response(out.join("\n"));
  },
};
