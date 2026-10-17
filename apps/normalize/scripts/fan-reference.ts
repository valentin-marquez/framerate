/**
 * Referencia de ventiladores por familia y tamaño (#181). Las fichas de cada fabricante se investigan aparte (agentes
 * y Playwright, una fila por familia y tamaño con su URL) y quedan en fan-reference.json; este script las carga:
 *
 *   bun scripts/fan-reference.ts build <filas.json>...   junta y valida, y escribe fan-reference.json
 *   bun scripts/fan-reference.ts sql > /tmp/fan-reference.sql
 *   cd ../../packages/database && bunx wrangler d1 execute framerate --remote --file /tmp/fan-reference.sql
 *
 * Y para completar lo ya normalizado, sin llamar a Haiku:
 *   bunx wrangler d1 execute framerate --remote --json --command "select listing_id, version, brand, identity,
 *     specs, specs_source from listing_identity where category = 'case_fan'" | bun
 *     ../../apps/normalize/scripts/fan-reference.ts backfill > /tmp/fan-backfill.sql
 */
import { type FanReference, fanKey, fillFromFanReference, pickFanReference } from "../src/fan-reference";

const DATA = new URL("./fan-reference.json", import.meta.url).pathname;
const BEARINGS = new Set(["fdb", "hydraulic", "rifle", "sleeve", "ball", "dual_ball", "maglev", "lcp_fdb"]);
const CONNECTORS = new Set(["3pin", "4pin_pwm", "molex", "proprietary"]);
const LIGHTING = new Set(["none", "rgb_12v", "argb_5v", "proprietary"]);

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
const bool = (v: unknown) => (typeof v === "boolean" ? v : null);
const pick = (v: unknown, allowed: Set<string>) =>
  typeof v === "string" && v.trim() ? (allowed.has(v.trim().toLowerCase()) ? v.trim().toLowerCase() : v.trim()) : null;

/** Una fila de la investigación, normalizada; null si no identifica una familia. */
export function toReference(r: Record<string, unknown>): FanReference | null {
  if (typeof r.brand !== "string" || typeof r.family !== "string" || !r.family.trim()) return null;
  const sizeMm = num(r.size_mm);
  return {
    brand: r.brand.trim(),
    family: r.family.trim(),
    size_mm: sizeMm,
    rpm_min: num(r.rpm_min),
    rpm_max: num(r.rpm_max),
    airflow_cfm: num(r.airflow_cfm),
    static_pressure_mmh2o: num(r.static_pressure_mmh2o),
    noise_dba: num(r.noise_dba),
    bearing: pick(r.bearing, BEARINGS),
    fan_connector: pick(r.fan_connector, CONNECTORS),
    lighting: pick(r.lighting, LIGHTING),
    controller: typeof r.controller === "string" && r.controller.trim() ? r.controller.trim() : null,
    requires_controller: bool(r.requires_controller),
    daisy_chain: bool(r.daisy_chain),
    warranty_years: num(r.warranty_years),
    aliases: Array.isArray(r.catalog_models) ? r.catalog_models.filter((m): m is string => typeof m === "string") : [],
    source_url: typeof r.source_url === "string" && /^https?:\/\//.test(r.source_url) ? r.source_url : null,
  };
}

const q = (v: unknown) =>
  v === null || v === undefined
    ? "NULL"
    : typeof v === "boolean"
      ? String(Number(v))
      : typeof v === "number"
        ? String(v)
        : `'${String(v).replaceAll("'", "''")}'`;

const [mode, ...args] = process.argv.slice(2);
if (import.meta.main && mode === "build") {
  const rows: FanReference[] = [];
  for (const path of args) {
    for (const r of JSON.parse(await Bun.file(path).text()) as Record<string, unknown>[]) {
      const ref = toReference(r);
      if (ref) rows.push(ref);
    }
  }
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const k = `${fanKey(r.brand)}|${fanKey(r.family)}|${r.size_mm}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  unique.sort((a, b) => `${a.brand} ${a.family} ${a.size_mm}`.localeCompare(`${b.brand} ${b.family} ${b.size_mm}`));
  await Bun.write(DATA, `${JSON.stringify(unique, null, 1)}\n`);
  const has = (k: keyof FanReference) => unique.filter((r) => r[k] !== null).length;
  console.error(
    `${unique.length} familias y tamaños; ruido ${has("noise_dba")}, presión ${has("static_pressure_mmh2o")}, rodamiento ${has("bearing")}, iluminación ${has("lighting")}`,
  );
} else if (import.meta.main && mode === "sql") {
  const rows = JSON.parse(await Bun.file(DATA).text()) as FanReference[];
  console.log("DELETE FROM fan_reference;");
  for (const r of rows) {
    const { aliases, ...rest } = r;
    const cols = ["brand_key", ...Object.keys(rest), "aliases"];
    const values = [fanKey(r.brand), ...Object.values(rest), JSON.stringify(aliases)];
    console.log(`INSERT INTO fan_reference (${cols.join(", ")}) VALUES (${values.map(q).join(", ")});`);
  }
  console.error(`${rows.length} filas`);
} else if (import.meta.main && mode === "backfill") {
  const byBrand = Map.groupBy(JSON.parse(await Bun.file(DATA).text()) as FanReference[], (r) => fanKey(r.brand));
  const input = await Bun.stdin.text();
  const rows = (JSON.parse(input.slice(input.indexOf("["))) as { results: Record<string, string | number>[] }[])[0]
    ?.results as {
    listing_id: number;
    version: number;
    brand: string | null;
    identity: string;
    specs: string;
    specs_source: string;
  }[];
  let n = 0;
  for (const row of rows) {
    const identity = JSON.parse(row.identity) as Record<string, string>;
    const ref = pickFanReference(
      byBrand.get(fanKey(row.brand ?? "")) ?? [],
      String(identity.model ?? ""),
      identity.size_mm,
    );
    if (!ref) continue;
    const { specs, source } = fillFromFanReference(JSON.parse(row.specs), JSON.parse(row.specs_source), ref);
    if (JSON.stringify(specs) === JSON.stringify(JSON.parse(row.specs))) continue;
    n++;
    console.log(
      `UPDATE listing_identity SET specs = ${q(JSON.stringify(specs))}, specs_source = ${q(JSON.stringify(source))} WHERE listing_id = ${row.listing_id} AND version = ${row.version};`,
    );
  }
  console.error(`${n} de ${rows.length} identidades completadas`);
} else if (import.meta.main) {
  throw new Error("uso: build <filas.json>... | sql | backfill");
}
