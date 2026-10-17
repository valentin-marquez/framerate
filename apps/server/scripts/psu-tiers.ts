/**
 * Reemplaza `psu_tier` (#177) con la versión actual de la tier list de fuentes. Uso interno: ver la migración 0028.
 * Además suma las notas propias de `psu-tiers.extra.json` (marcas que la planilla no evalúa, desde reseñas con
 * mediciones), siempre como especulativas. Las notas van en español: las traducciones viven en `psu-tiers.es.json`, y las notas nuevas se traducen con Haiku
 * si hay `ANTHROPIC_API_KEY` (si no, quedan en inglés y el script lo avisa).
 *
 *   cd apps/server
 *   bun scripts/psu-tiers.ts > /tmp/psu-tiers.sql
 *   bunx wrangler d1 execute framerate --remote --file /tmp/psu-tiers.sql
 */
import { BRAND_BASE, brandBase, brandKeys, parsePsuTiers } from "../src/features/compatibility/psu-tier";

const SHEET = "https://docs.google.com/spreadsheets/d/1akCHL7Vhzk_EhrpIGkz8zTEvYfLDcaSpZRB6Xt6JWkc/gviz/tq?tqx=out:csv";
const FULL_LIST = 931697732;
const ABOUT = 1719706335;
const CACHE = new URL("./psu-tiers.es.json", import.meta.url).pathname;
const EXTRA = new URL("./psu-tiers.extra.json", import.meta.url).pathname;

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

// Notas propias para marcas que la planilla no evalúa: siempre especulativas, con sus fuentes.
const extra = JSON.parse(await Bun.file(EXTRA).text()) as {
  brand: string;
  series: string;
  variant?: string;
  wattages: number[];
  tier: string | null;
  odm?: string | null;
  platform?: string | null;
  efficiency?: string | null;
  notes_es?: string;
  sources: string[];
}[];
const rated = extra.filter((r) => r.tier);
for (const r of rated) {
  const values = [
    r.brand,
    ` ${brandKeys(r.brand).join(" ")} `,
    r.series,
    "",
    r.variant ?? "",
    JSON.stringify(r.wattages),
    r.tier,
    1,
    r.odm ?? null,
    r.platform ?? null,
    r.efficiency ?? null,
    r.notes_es ?? null,
    "propia",
    "own",
    JSON.stringify(r.sources),
  ];
  lines.push(
    `INSERT INTO psu_tier (brand, brand_key, series, subseries, variant, wattages, tier, limited, odm, platform, efficiency, notes, source_version, origin, source_urls) VALUES (${values.map(q).join(", ")});`,
  );
}

// Nota base por marca: de sus propias notas en la planilla, o de una investigación general para las que no están.
const BRANDS = new URL("./psu-tiers.brands.json", import.meta.url).pathname;
const researched = JSON.parse(await Bun.file(BRANDS).text()) as {
  brand: string;
  tier: string;
  best: string;
  notes_es: string;
  sources: string[];
}[];
const bases = [
  ...Map.groupBy(
    rows.filter((r) => !r.limited),
    (r) => r.brand,
  ),
].flatMap(([brand, rs]) => {
  const base = brandBase(rs.map((r) => r.tier));
  return base
    ? [
        {
          brand,
          ...base,
          notes_es: `Nota base de la marca: la mitad central de sus ${rs.length} modelos evaluados.`,
          sources: [] as string[],
        },
      ]
    : [];
});
for (const b of [...bases, ...researched]) {
  const values = [
    b.brand,
    ` ${brandKeys(b.brand).join(" ")} `,
    BRAND_BASE,
    "",
    "",
    "[]",
    b.tier,
    b.best,
    1,
    b.notes_es,
    "marca",
    "brand",
    JSON.stringify(b.sources),
  ];
  lines.push(
    `INSERT INTO psu_tier (brand, brand_key, series, subseries, variant, wattages, tier, best, limited, notes, source_version, origin, source_urls) VALUES (${values.map(q).join(", ")});`,
  );
}
console.log(lines.join("\n"));
console.error(
  `${rows.length} filas, versión ${version}; ${untranslated} notas sin traducir; ${rated.length} notas propias; ${bases.length + researched.length} notas de marca`,
);

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
