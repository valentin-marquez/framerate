/**
 * Referencia por modelo de coolers y gabinetes (#182). Las fichas se investigan aparte (agentes y Playwright, una fila
 * por modelo con su URL); este script las pasa al formato de `listing_identity.specs` que leen las reglas de
 * compatibilidad, y las carga:
 *
 *   bun scripts/part-reference.ts build <cpu_cooler|case> <filas.json>...   agrega a part-reference.json
 *   bun scripts/part-reference.ts sql > /tmp/part-reference.sql
 *   cd ../../packages/database && bunx wrangler d1 execute framerate --remote --file /tmp/part-reference.sql
 *
 * Y para completar lo ya normalizado, sin llamar a Haiku:
 *   bunx wrangler d1 execute framerate --remote --json --command "select listing_id, version, category, brand,
 *     identity, specs, specs_source from listing_identity where category in ('cpu_cooler', 'case')" | bun
 *     ../../apps/normalize/scripts/part-reference.ts backfill > /tmp/part-backfill.sql
 */
import type { IdentityValue } from "@framerate/contracts";
import { fillFromPartReference, type PartReference, partKey, pickPartReference } from "../src/part-reference";

const DATA = new URL("./part-reference.json", import.meta.url).pathname;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
const LIGHTING = new Set(["none", "argb_5v", "rgb_12v", "proprietary"]);
const BOARDS: Record<string, string> = { eatx: "E-ATX", atx: "ATX", matx: "mATX", itx: "ITX" };

/** "lga1851" → "LGA1851", "lga115x" → "LGA115X", "am5" → "AM5": el texto que lee `sockets()` de la compatibilidad. */
export function socketText(list: unknown): string | null {
  if (!Array.isArray(list)) return null;
  const out = list.filter(
    (s): s is string => typeof s === "string" && /^(lga\d{3,4}x?|am\d\+?|fm\d\+?|str\d|tr\d|sp\d)$/i.test(s),
  );
  return out.length > 0 ? [...new Set(out.map((s) => s.toUpperCase()))].join(", ") : null;
}

/** Una fila de la investigación en el formato de las specs; null si no identifica un modelo. */
export function toReference(category: string, r: Record<string, unknown>): PartReference | null {
  if (typeof r.brand !== "string" || typeof r.model !== "string" || !r.model.trim()) return null;
  const specs: Record<string, IdentityValue | null> = {};
  if (category === "cpu_cooler") {
    specs.type = r.type === "air" || r.type === "aio" ? r.type : null;
    specs.height_mm = r.type === "air" ? num(r.height_mm) : null;
    specs.radiator_mm = r.type === "aio" ? num(r.radiator_mm) : null;
    specs.fan_size_mm = num(r.fan_size_mm);
    specs.fan_count = num(r.fan_count);
    // Si la ficha sólo dice "Intel/AMD" no se escribe nada: la regla lo trata como desconocido (#178).
    specs.sockets = r.sockets_vague ? null : socketText(r.sockets);
    specs.tdp_rating_w = num(r.tdp_rating_w);
    specs.ram_clearance_mm = num(r.ram_clearance_mm);
    specs.noise_dba_max = num(r.noise_dba_max);
    specs.lighting = typeof r.rgb === "string" && LIGHTING.has(r.rgb) ? r.rgb : null;
  } else {
    const boards = Array.isArray(r.motherboards)
      ? r.motherboards.flatMap((b) => BOARDS[String(b).toLowerCase()] ?? [])
      : [];
    specs.supported_motherboard_form_factors = boards.length > 0 ? boards.join(", ") : null;
    specs.max_gpu_length_mm = num(r.max_gpu_length_mm);
    specs.max_cpu_cooler_height_mm = num(r.max_cpu_cooler_height_mm);
    const rad = (r.radiators ?? {}) as Record<string, unknown>;
    const names: Record<string, string> = {
      front: "frente",
      top: "techo",
      side: "lado",
      bottom: "fondo",
      rear: "atrás",
    };
    const radiators = Object.entries(names).flatMap(([k, es]) => (num(rad[k]) ? [`${es} ${num(rad[k])}`] : []));
    specs.radiator_support_mm = radiators.length > 0 ? radiators.join(", ") : null;
    specs.max_psu_length_mm = num(r.max_psu_length_mm);
    specs.included_fans = typeof r.included_fans === "number" && r.included_fans >= 0 ? r.included_fans : null;
  }
  return {
    category,
    brand: r.brand.trim(),
    model: r.model.trim(),
    specs: Object.fromEntries(Object.entries(specs).filter(([, v]) => v !== null)) as Record<string, IdentityValue>,
    aliases: Array.isArray(r.catalog_models) ? r.catalog_models.filter((m): m is string => typeof m === "string") : [],
    source_url: typeof r.source_url === "string" && /^https?:\/\//.test(r.source_url) ? r.source_url : null,
  };
}

const q = (v: unknown) => (v === null || v === undefined ? "NULL" : `'${String(v).replaceAll("'", "''")}'`);

const [mode, ...args] = process.argv.slice(2);
if (import.meta.main && mode === "build") {
  const [category, ...paths] = args;
  if (category !== "cpu_cooler" && category !== "case") throw new Error("uso: build <cpu_cooler|case> <filas.json>...");
  const kept = ((await Bun.file(DATA).exists()) ? JSON.parse(await Bun.file(DATA).text()) : []) as PartReference[];
  const rows = kept.filter((r) => r.category !== category);
  // El mismo modelo puede venir de varias fuentes (búsqueda y ficha bajada): la primera manda y las demás completan
  // lo que le falte; los nombres del catálogo se juntan.
  const byKey = new Map<string, PartReference>();
  for (const path of paths) {
    for (const raw of JSON.parse(await Bun.file(path).text()) as Record<string, unknown>[]) {
      const ref = toReference(category, raw);
      if (!ref || Object.keys(ref.specs).length === 0) continue;
      const k = `${partKey(ref.brand)}|${partKey(ref.model)}|${ref.specs.radiator_mm ?? ""}`;
      const prev = byKey.get(k);
      if (!prev) byKey.set(k, ref);
      else {
        prev.specs = { ...ref.specs, ...prev.specs };
        prev.aliases = [...new Set([...prev.aliases, ...ref.aliases])];
        prev.source_url ??= ref.source_url;
      }
    }
  }
  rows.push(...byKey.values());
  rows.sort((a, b) => `${a.category} ${a.brand} ${a.model}`.localeCompare(`${b.category} ${b.brand} ${b.model}`));
  await Bun.write(DATA, `${JSON.stringify(rows, null, 1)}\n`);
  const mine = rows.filter((r) => r.category === category);
  const has = (k: string) => mine.filter((r) => r.specs[k] !== undefined).length;
  console.error(
    category === "cpu_cooler"
      ? `${mine.length} coolers; alto ${has("height_mm")}, radiador ${has("radiator_mm")}, sockets ${has("sockets")}`
      : `${mine.length} gabinetes; GPU ${has("max_gpu_length_mm")}, cooler ${has("max_cpu_cooler_height_mm")}, radiadores ${has("radiator_support_mm")}, placas ${has("supported_motherboard_form_factors")}`,
  );
} else if (import.meta.main && mode === "sql") {
  const rows = JSON.parse(await Bun.file(DATA).text()) as PartReference[];
  console.log("DELETE FROM part_reference;");
  for (const r of rows) {
    const values = [
      r.category,
      r.brand,
      partKey(r.brand),
      r.model,
      JSON.stringify(r.specs),
      JSON.stringify(r.aliases),
      r.source_url,
    ];
    console.log(
      `INSERT INTO part_reference (category, brand, brand_key, model, specs, aliases, source_url) VALUES (${values.map(q).join(", ")});`,
    );
  }
  console.error(`${rows.length} filas`);
} else if (import.meta.main && mode === "backfill") {
  const byKey = Map.groupBy(
    JSON.parse(await Bun.file(DATA).text()) as PartReference[],
    (r) => `${r.category}|${partKey(r.brand)}`,
  );
  const input = await Bun.stdin.text();
  const rows = (JSON.parse(input.slice(input.indexOf("["))) as { results: Record<string, string | number>[] }[])[0]
    ?.results as {
    listing_id: number;
    version: number;
    category: string;
    brand: string | null;
    identity: string;
    specs: string;
    specs_source: string;
  }[];
  let n = 0;
  for (const row of rows) {
    const identity = JSON.parse(row.identity) as Record<string, string>;
    const refs = byKey.get(`${row.category}|${partKey(row.brand ?? "")}`) ?? [];
    const ref = pickPartReference(refs, String(identity.model ?? ""), identity.radiator_mm);
    if (!ref) continue;
    const { specs, source } = fillFromPartReference(JSON.parse(row.specs), JSON.parse(row.specs_source), ref);
    if (JSON.stringify(specs) === JSON.stringify(JSON.parse(row.specs))) continue;
    n++;
    console.log(
      `UPDATE listing_identity SET specs = ${q(JSON.stringify(specs))}, specs_source = ${q(JSON.stringify(source))} WHERE listing_id = ${row.listing_id} AND version = ${row.version};`,
    );
  }
  console.error(`${n} de ${rows.length} identidades completadas`);
} else if (import.meta.main) {
  throw new Error("uso: build <cpu_cooler|case> <filas.json>... | sql | backfill");
}
