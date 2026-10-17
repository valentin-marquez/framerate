/**
 * Reemplaza `psu_tier` (#177) con la versión actual de la tier list de fuentes. Uso interno: ver la migración 0028.
 * Las notas van en español: las traducciones viven en `psu-tiers.es.json`, y las notas nuevas se traducen con Haiku
 * si hay `ANTHROPIC_API_KEY` (si no, quedan en inglés y el script lo avisa).
 *
 *   cd apps/server
 *   bun scripts/psu-tiers.ts > /tmp/psu-tiers.sql
 *   bunx wrangler d1 execute framerate --remote --file /tmp/psu-tiers.sql
 */
import { brandKeys, parsePsuTiers } from "../src/features/compatibility/psu-tier";

const SHEET = "https://docs.google.com/spreadsheets/d/1akCHL7Vhzk_EhrpIGkz8zTEvYfLDcaSpZRB6Xt6JWkc/gviz/tq?tqx=out:csv";
const FULL_LIST = 931697732;
const ABOUT = 1719706335;
const CACHE = new URL("./psu-tiers.es.json", import.meta.url).pathname;

const sheet = async (gid: number) => {
  const res = await fetch(`${SHEET}&gid=${gid}`);
  if (!res.ok) throw new Error(`planilla ${gid}: HTTP ${res.status}`);
  return res.text();
};

const rows = parsePsuTiers(await sheet(FULL_LIST));
const version = (await sheet(ABOUT)).match(/Current Version: ([\d.]+)/)?.[1] ?? "desconocida";
const cache: Record<string, string> = await Bun.file(CACHE)
  .json()
  .catch(() => ({}));

const missing = [...new Set(rows.map((r) => r.notes).filter((n) => n && !cache[n]))];
const key = process.env.ANTHROPIC_API_KEY;
if (missing.length > 0 && key) {
  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50);
    const out = await translate(batch, key);
    batch.forEach((en, j) => {
      if (out[j]) cache[en] = out[j];
    });
  }
  await Bun.write(CACHE, `${JSON.stringify(cache, null, 1)}\n`);
}
const untranslated = missing.filter((n) => !cache[n]).length;

const q = (v: string | number | null) =>
  v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replaceAll("'", "''")}'`;
const lines = ["DELETE FROM psu_tier;"];
for (const r of rows) {
  const values = [
    r.brand,
    ` ${brandKeys(r.brand).join(" ")} `,
    r.series,
    r.subseries,
    r.variant,
    JSON.stringify(r.wattages),
    r.tier,
    r.limited ? 1 : 0,
    r.year,
    r.formFactor,
    r.atxVersion,
    r.modular,
    r.efficiency,
    r.odm || null,
    r.platform || null,
    r.notes ? (cache[r.notes] ?? r.notes) : null,
    version,
  ];
  lines.push(
    `INSERT INTO psu_tier (brand, brand_key, series, subseries, variant, wattages, tier, limited, year, form_factor, atx_version, modular, efficiency, odm, platform, notes, source_version) VALUES (${values.map(q).join(", ")});`,
  );
}
console.log(lines.join("\n"));
console.error(`${rows.length} filas, versión ${version}; ${untranslated} notas sin traducir`);

async function translate(notes: string[], apiKey: string): Promise<string[]> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-5-5",
      max_tokens: 16000,
      system:
        "Traduces al español de Chile notas técnicas de fuentes de poder de PC. Tuteo, registro técnico, sin guiones largos. Deja como sigla OCP, OVP, OPP, OTP, ripple, hold-up time, PFC, LLC, DC-DC, ODM, 12VHPWR, 12V-2x6 y los nombres de marcas y modelos. Respondes sólo un arreglo JSON de strings, en el mismo orden y con el mismo largo que la entrada.",
      messages: [{ role: "user", content: JSON.stringify(notes) }],
    }),
  });
  if (!res.ok) throw new Error(`Haiku: HTTP ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { content: { type: string; text?: string }[] };
  const text = body.content.find((c) => c.type === "text")?.text ?? "[]";
  const out = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)) as string[];
  return out.length === notes.length ? out : [];
}
