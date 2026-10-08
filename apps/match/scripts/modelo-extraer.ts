import type { Category } from "@framerate/contracts";
import { buildFingerprint, compare } from "@framerate/matching";
import { MODEL } from "../src/judge";

// ¿Puede Gemma sacar el código de modelo del título en gabinetes, coolers y ventiladores, donde no hay clave de
// atributos (#98)? Worker local con el binding AI.
//   bunx wrangler dev -c scripts/wrangler.modelo.jsonc ; curl "http://127.0.0.1:8797/" -d @muestra-modelos.json
const SYSTEM =
  "You extract the manufacturer's model name from a PC component listing title from a Chilean store. " +
  "Answer with only the model name, copied verbatim from the title, and nothing else. " +
  "The model name identifies the product line and version, for example: NR200P, 4000D AIRFLOW, H5 Flow, AK620, " +
  "P12 PWM, FV270, FN12A, MasterLiquid 240L. " +
  "Do NOT include: the brand, the color, the size in mm or inches, the form factor (ATX, mATX, ITX), the pack size, " +
  "RGB or ARGB, the wattage, or marketing words. " +
  "If the title has no model name, answer exactly: none";

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

interface Item {
  id: number;
  category: string;
  brand: string;
  name: string;
}

async function extract(ai: Ai, item: Item): Promise<{ raw: string; neurons: number }> {
  const res = (await ai.run(
    MODEL as Parameters<Ai["run"]>[0],
    {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Brand: ${item.brand}\nTitle: ${item.name}` },
      ],
      max_tokens: 24,
      temperature: 0,
      // Sin esto Gemma 4 gasta los tokens razonando y devuelve contenido vacío.
      chat_template_kwargs: { enable_thinking: false },
    } as never,
  )) as { response?: string; choices?: Array<{ message: { content: string } }>; usage?: { neurons?: number } };
  const raw = (res.response ?? res.choices?.[0]?.message?.content ?? "").trim();
  return { raw, neurons: res.usage?.neurons ?? 0 };
}

/** Pares dentro de un grupo, con la comparación real (vetos incluidos). */
function paresDe(v: Array<Item & { modelo: string }>) {
  const out: Array<{ a: Item; b: Item; c: ReturnType<typeof compare> }> = [];
  for (let i = 0; i < v.length; i++) {
    for (let j = i + 1; j < v.length; j++) {
      const a = v[i];
      const b = v[j];
      if (!a || !b) continue;
      const fa = buildFingerprint({ category: a.category as Category, title: a.name, brand: a.brand });
      const fb = buildFingerprint({ category: b.category as Category, title: b.name, brand: b.brand });
      out.push({ a, b, c: compare(fa, fb) });
    }
  }
  return out;
}

export default {
  async fetch(request: Request, env: { AI: Ai }) {
    const items = (await request.json()) as Item[];
    const limit = Number(new URL(request.url).searchParams.get("n") ?? items.length);
    const out: Array<Item & { modelo: string; valido: boolean }> = [];
    let neurons = 0;
    for (const item of items.slice(0, limit)) {
      const { raw, neurons: n } = await extract(env.AI, item);
      neurons += n;
      const modelo = raw.replace(/^model( name)?:/i, "").trim();
      // Guarda contra invención: lo que devuelve tiene que estar literal en el título.
      const valido = modelo.toLowerCase() !== "none" && modelo.length > 1 && fold(item.name).includes(fold(modelo));
      out.push({ ...item, modelo, valido });
    }
    const validos = out.filter((o) => o.valido);
    const claves = new Map<string, typeof out>();
    for (const o of validos) {
      const k = `${o.category}|${fold(o.brand)}|${fold(o.modelo)}`;
      claves.set(k, [...(claves.get(k) ?? []), o]);
    }
    const grupos = [...claves.entries()].filter(([, v]) => v.length > 1);
    const lineas = [
      `pedidos: ${out.length}  neurons: ${neurons.toFixed(1)} (${(neurons / Math.max(out.length, 1)).toFixed(2)} por producto)`,
      `con modelo válido (aparece literal en el título): ${validos.length}/${out.length}`,
      `inventados o vacíos: ${out.filter((o) => !o.valido).length}`,
      `grupos de 2 o más con la misma clave: ${grupos.length} (${grupos.reduce((n, [, v]) => n + v.length, 0)} productos)`,
      "",
      "== grupos ==",
      ...grupos
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 30)
        .flatMap(([k, v]) => [
          `  ${k}`,
          ...v.map((o) => `     P${o.id} [${o.modelo}] ${o.name.slice(0, 66)}`),
          ...paresDe(v).map(({ a, b, c }) => {
            const sim = c.evidence.titleSimilarity ?? 0;
            const conClave = 0.35 * sim + 0.55 + (c.evidence.brandMatch ? 0.1 : 0);
            return `     P${a.id}+P${b.id}: ${c.vetoes.length ? `VETADO ${c.vetoes.join(",")}` : `sin vetos, hoy ${c.score.toFixed(2)}, con clave ${conClave.toFixed(2)}`}`;
          }),
        ]),
      "",
      "== no válidos ==",
      ...out
        .filter((o) => !o.valido)
        .slice(0, 20)
        .map((o) => `  [${o.modelo}] <- ${o.name.slice(0, 70)}`),
    ];
    return new Response(lineas.join("\n"));
  },
};
