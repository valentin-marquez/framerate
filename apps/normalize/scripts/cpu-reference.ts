/**
 * Referencia de procesadores (#179). Tres pasos, cada uno revisable antes de aplicar:
 *
 * 1. Armar `cpu-reference.json` desde lo bajado de las fichas oficiales con Playwright (Intel corta las peticiones sin
 *    navegador; las extracciones están en docs/specs/2026-10-16-referencia-procesadores.md):
 *      bun scripts/cpu-reference.ts build <amd.json> <intel.json>
 * 2. Cargar la tabla:
 *      bun scripts/cpu-reference.ts sql > /tmp/cpu-reference.sql
 *      cd ../../packages/database && bunx wrangler d1 execute framerate --remote --file /tmp/cpu-reference.sql
 * 3. Corregir las identidades ya normalizadas, sin volver a llamar a Haiku:
 *      bunx wrangler d1 execute framerate --remote --json --command "select listing_id, version, identity, specs,
 *        specs_source from listing_identity where category = 'cpu'" | bun ../../apps/normalize/scripts/cpu-reference.ts
 *        backfill > /tmp/cpu-backfill.sql
 *      bunx wrangler d1 execute framerate --remote --file /tmp/cpu-backfill.sql
 */
import { type CpuReference, modelKey, modelNumber, withReference } from "../src/cpu-reference";

const DATA = new URL("./cpu-reference.json", import.meta.url).pathname;
const AMD_SOURCE = "https://www.amd.com/en/products/specifications/processors.html";

const clean = (s: string) => s.replace(/[®™‡]/g, "").replace(/\s+/g, " ").trim();
const number = (s: string | undefined) => {
  const m = s?.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};
const int = (s: string | undefined) => {
  const n = number(s);
  return n === null ? null : Math.round(n);
};
const memoryTypes = (s: string | undefined) => {
  const types = [...new Set([...(s ?? "").matchAll(/\bDDR([345])/g)].map((m) => `DDR${m[1]}`))].sort();
  return types.length > 0 ? types.join(", ") : null;
};
const maxSpeed = (s: string | undefined) => {
  const speeds = [...(s ?? "").matchAll(/(\d{4})\s*MT\/s/g)].map((m) => Number(m[1]));
  return speeds.length > 0 ? Math.max(...speeds) : null;
};

/** "AMD Ryzen™ 7 7800X3D" → "ryzen 7 7800x3d"; "Intel® Core™ Ultra 7 Processor 265K" → "core ultra 7 265k". */
export const canonicalModel = (name: string) =>
  clean(name)
    .replace(/Specifications$/i, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+with\s.*$/i, "")
    .replace(/^\d+(st|nd|rd|th) Gen\s+/i, "")
    .replace(/^(AMD|Intel)\s+/i, "")
    .replace(/\s*\b(Processor|APU)\b/gi, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Una fila de la tabla de especificaciones de AMD; null si no es de socket (las de notebook van soldadas). */
export function fromAmd(heads: string[], cells: string[]): CpuReference | null {
  const get = (h: string) => cells[heads.indexOf(h)] ?? "";
  const socket = get("CPU Socket").split(",")[0]?.trim() ?? "";
  if (!/^(AM\d\+?|sTR\w*|sWRX\w*)$/.test(socket)) return null;
  const model = canonicalModel(get("Name"));
  const graphics = clean(get("Graphics Model"));
  const pib = clean(get("Thermal Solution (PIB)"));
  return {
    model,
    brand: "amd",
    name: clean(get("Name")),
    number: modelNumber(model),
    socket,
    cores_total: int(get("# of CPU Cores")),
    cores_performance: null,
    cores_efficiency: null,
    threads: int(get("# of Threads")),
    base_ghz: number(get("Base Clock")),
    boost_ghz: number(get("Max. Boost Clock")),
    l3_mb: number(get("L3 Cache")),
    tdp_w: int(get("Default TDP")),
    max_power_w: null,
    integrated_graphics: !graphics || /discrete/i.test(graphics) ? null : graphics.replace(/ graphics$/i, " Graphics"),
    boxed_cooler: !pib ? null : /not included/i.test(pib) ? "" : pib,
    memory_types: memoryTypes(get("System Memory Type")),
    memory_max_mt_s: maxSpeed(get("System Memory Specification")),
    launch: get("Launch Date") || null,
    part_numbers: ["Product ID Boxed", "Product ID Tray", "Product ID MPK"]
      .flatMap((h) => get(h).split(","))
      .map((p) => p.replace(/\(.*?\)/g, "").trim())
      .filter(Boolean),
    source_url: AMD_SOURCE,
  };
}

/** Una ficha de Intel ARK: pares clave → valor de la pestaña de especificaciones. */
export function fromIntel(name: string, url: string, s: Record<string, string>): CpuReference {
  const model = canonicalModel(name);
  const socket = s["Sockets Supported"]?.split(",")[0]?.trim().replace(/^FC/, "").replace(/\s+/g, "") ?? null;
  return {
    model,
    brand: "intel",
    name: clean(name.replace(/Specifications$/, "")),
    number: modelNumber(model),
    socket,
    cores_total: int(s["Total Cores"]),
    cores_performance: int(s["# of Performance-cores"]),
    cores_efficiency: int(s["# of Efficient-cores"]),
    threads: int(s["Total Threads"]),
    base_ghz: number(s["Performance-core Base Frequency"] ?? s["Processor Base Frequency"]),
    boost_ghz: number(s["Max Turbo Frequency"]),
    l3_mb: number(s.Cache),
    tdp_w: int(s["Processor Base Power"] ?? s.TDP),
    max_power_w: int(s["Maximum Turbo Power"]),
    integrated_graphics: s["GPU Name‡"] ? clean(s["GPU Name‡"]) : null,
    boxed_cooler: null,
    memory_types: memoryTypes(s["Memory Types"]),
    memory_max_mt_s: maxSpeed(s["Memory Types"]),
    launch: s["Launch Date"] ?? null,
    part_numbers: [],
    source_url: url,
  };
}

const q = (v: unknown) =>
  v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replaceAll("'", "''")}'`;

const [mode, ...args] = process.argv.slice(2);
if (import.meta.main && mode === "build") {
  const [amdPath, intelPath] = args;
  if (!amdPath || !intelPath) throw new Error("uso: build <amd.json> <intel.json>");
  const read = async (p: string) => {
    const v = JSON.parse(await Bun.file(p).text());
    return typeof v === "string" ? JSON.parse(v) : v;
  };
  const amd = (await read(amdPath)) as { heads: string[]; rows: string[][] };
  const intel = (await read(intelPath)) as { specs: { name: string; url: string; specs: Record<string, string> }[] };
  const rows = new Map<string, CpuReference>();
  for (const cells of amd.rows) {
    const r = fromAmd(amd.heads, cells);
    // Sin número no hay cómo encontrarla desde un título ("AMD B57").
    if (r?.number) rows.set(r.model, r);
  }
  for (const p of intel.specs) {
    if (!p.name || !p.specs?.["Total Cores"]) {
      console.error(`ficha de Intel vacía, se salta: ${p.url}`);
      continue;
    }
    const r = fromIntel(p.name, p.url, p.specs);
    rows.set(r.model, r);
  }
  const sorted = [...rows.values()].sort((a, b) => a.model.localeCompare(b.model));
  await Bun.write(DATA, `${JSON.stringify(sorted, null, 1)}\n`);
  console.error(`${sorted.length} modelos (${sorted.filter((r) => r.brand === "amd").length} AMD)`);
} else if (import.meta.main && mode === "sql") {
  const rows = JSON.parse(await Bun.file(DATA).text()) as CpuReference[];
  const cols = Object.keys(rows[0] ?? {}) as (keyof CpuReference)[];
  console.log("DELETE FROM cpu_reference;");
  for (const r of rows) {
    const values = cols.map((c) => (c === "part_numbers" ? q(JSON.stringify(r[c])) : q(r[c])));
    console.log(`INSERT INTO cpu_reference (${cols.join(", ")}) VALUES (${values.join(", ")});`);
  }
  console.error(`${rows.length} modelos`);
} else if (import.meta.main && mode === "backfill") {
  const refs = new Map((JSON.parse(await Bun.file(DATA).text()) as CpuReference[]).map((r) => [modelKey(r.model), r]));
  const input = await Bun.stdin.text();
  const rows = (JSON.parse(input.slice(input.indexOf("["))) as { results: Record<string, string | number>[] }[])[0]
    ?.results as { listing_id: number; version: number; identity: string; specs: string; specs_source: string }[];
  let n = 0;
  for (const row of rows) {
    const identity = JSON.parse(row.identity) as Record<string, string>;
    const ref = refs.get(modelKey(identity.model ?? ""));
    if (!ref) continue;
    const { specs, source } = withReference(
      JSON.parse(row.specs),
      JSON.parse(row.specs_source),
      ref,
      identity.packaging ?? "",
    );
    n++;
    console.log(
      `UPDATE listing_identity SET specs = ${q(JSON.stringify(specs))}, specs_source = ${q(JSON.stringify(source))} WHERE listing_id = ${row.listing_id} AND version = ${row.version};`,
    );
  }
  console.error(`${n} de ${rows.length} identidades con referencia`);
} else if (import.meta.main) {
  throw new Error("uso: build <amd.json> <intel.json> | sql | backfill");
}
