import { mkdir } from "node:fs/promises";
import goldJson from "../src/features/ingestion/domain/match-gold.json";

type Side = { store: string; rawTitle: string; brand: string | null; mpn: string | null };
const gold = goldJson as { confidence: string; label: string; note: string; a: Side; b: Side }[];

// Experimento aislado con Clef/Clef-flash (#105, docs/specs/2026-10-03-clef-experimento-plan.md). No toca producción.
// Uso: CLOUDFLARE_API_TOKEN=… bun scripts/clef-experimento.ts --model clef-flash --tarea par|categoria
//   [--idioma en|es] [--limite 20] [--repeticiones 1] [--entrada ofertas.json] [--tope-tokens 400000]
// `categoria` lee --entrada: [{ id, title, brand, category, esperado: "si" | "no" }]. Resultados: /tmp/clef-experimento/.
const ACCOUNT = "3f50a4a123ebcbcb917dababff3ef8b5";
const MIN_INTERVAL_MS = 300;

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const model = arg("model", "clef-flash") as "clef" | "clef-flash";
const tarea = arg("tarea", "par") as "par" | "categoria" | "ajuste";
const idioma = arg("idioma", "en") as "en" | "es";
const limite = Number(arg("limite", "20"));
const repeticiones = Number(arg("repeticiones", "1"));
const topeTokens = Number(arg("tope-tokens", "400000"));
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error("Falta CLOUDFLARE_API_TOKEN");

const QUESTIONS = {
  par: {
    en: "Are these two listings exactly the same product, with the same variant, model and color? Different capacity, model suffix, color or edition means they are different products.",
    es: "¿Estas dos ofertas son exactamente el mismo producto, con la misma variante, modelo y color? Distinta capacidad, sufijo de modelo, color o edición significa que son productos distintos.",
  },
  ajuste: {
    en: "Is this listing a product of the category named in `category`? Categories: gpu = graphics card; cpu = processor; cpu_cooler = CPU heatsink, air cooler or AIO liquid cooler (not case fans, thermal paste or mounting kits); case_fan = fan for a PC case; case = PC case; psu = power supply; ram = memory module; ssd = solid-state drive (SATA or NVMe); hdd = mechanical hard drive (not SSD); motherboard = motherboard.",
    es: "",
  },
  categoria: {
    en: "Is this listing the component itself for its category, and not an accessory, bundle, prebuilt PC, spare part or service?",
    es: "¿Esta oferta es el componente en sí de su categoría, y no un accesorio, un combo, un equipo armado, un repuesto ni un servicio?",
  },
};

type Item = { id: string; state: unknown; esperado: string; nota?: string };

function itemsPar(): Item[] {
  const side = (s: Side) => ({ store: s.store, title: s.rawTitle, brand: s.brand, mpn: s.mpn });
  const pares = gold.filter((p) => p.confidence === "high" && p.label !== "unsure");
  return pares.flatMap((p, i) => [
    { id: `${i}-ab`, state: { a: side(p.a), b: side(p.b) }, esperado: p.label, nota: p.note },
    { id: `${i}-ba`, state: { a: side(p.b), b: side(p.a) }, esperado: p.label, nota: p.note },
  ]);
}

async function itemsCategoria(): Promise<Item[]> {
  const file = arg("entrada");
  if (!file) throw new Error("--tarea categoria necesita --entrada");
  const rows: { id: string; title: string; brand: string | null; category: string; esperado: string }[] = JSON.parse(
    await Bun.file(file).text(),
  );
  return rows.map((r) => ({
    id: r.id,
    state: { category: r.category, title: r.title, brand: r.brand },
    esperado: r.esperado,
  }));
}

let gastados = 0;
let ultimo = 0;
async function preguntar(state: unknown): Promise<unknown> {
  const body = JSON.stringify({
    model,
    state,
    questions: { respuesta: { type: "noul", instructions: QUESTIONS[tarea][idioma] } },
  });
  for (let intento = 0; intento < 5; intento++) {
    await Bun.sleep(Math.max(0, ultimo + MIN_INTERVAL_MS - Date.now()));
    ultimo = Date.now();
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/@cf/cloudflare/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body,
    });
    if (res.status === 429) {
      await Bun.sleep(2000 * 2 ** intento);
      continue;
    }
    const json = (await res.json()) as { result?: { usage?: { input_tokens?: number } } };
    gastados += json.result?.usage?.input_tokens ?? Math.ceil(body.length / 4);
    return json;
  }
  throw new Error("429 sostenido");
}

const items = (tarea === "par" ? itemsPar() : await itemsCategoria()).slice(0, limite);
const resultados: unknown[] = [];
for (let r = 0; r < repeticiones; r++) {
  for (const item of items) {
    if (gastados >= topeTokens) break;
    const respuesta = await preguntar(item.state);
    resultados.push({ ...item, repeticion: r, respuesta });
    console.log(item.id, item.esperado, JSON.stringify(respuesta).slice(0, 160));
  }
}

type Resultado = { esperado: string; respuesta: { result?: { answers?: { respuesta?: { noul?: number } } } } };
function resumen(rs: Resultado[]) {
  const p = (r: Resultado) => r.respuesta.result?.answers?.respuesta?.noul;
  const dis = (esperadoNo: string) => rs.filter((r) => r.esperado === esperadoNo && p(r) !== undefined);
  const no = tarea === "par" ? "different" : "no";
  const si = tarea === "par" ? "same" : "si";
  for (const t of [0.1, 0.2, 0.3, 0.5, 0.7, 0.8, 0.9]) {
    const predNo = rs.filter((r) => (p(r) ?? 1) < t);
    const aciertosNo = predNo.filter((r) => r.esperado === no).length;
    const predSi = rs.filter((r) => (p(r) ?? 0) >= t);
    const aciertosSi = predSi.filter((r) => r.esperado === si).length;
    console.log(
      `umbral ${t}: "${no}" ${aciertosNo}/${predNo.length} (recall ${aciertosNo}/${dis(no).length}), "${si}" ${aciertosSi}/${predSi.length} (recall ${aciertosSi}/${dis(si).length})`,
    );
  }
}
resumen(resultados as Resultado[]);

const dir = "/tmp/clef-experimento";
await mkdir(dir, { recursive: true });
const out = `${dir}/${new Date().toISOString().replace(/[:.]/g, "-")}-${model}-${tarea}-${idioma}.json`;
await Bun.write(out, JSON.stringify({ model, tarea, idioma, tokensEstimados: gastados, resultados }, null, 2));
console.log(`${resultados.length} respuestas, ~${gastados} tokens estimados → ${out}`);
