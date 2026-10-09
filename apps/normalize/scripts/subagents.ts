// Normalización de una sola vez con subagentes de Claude Code en vez de la API (#153). Mismo prompt, esquema, zod y
// anclaje que el Worker; lo único distinto es quién llama al modelo. Uso:
//   bun scripts/subagents.ts export <dir> <categoría,...> [--normalized N]   tandas de entrada en <dir>/in
//   bun scripts/subagents.ts import <dir>                                   valida, ancla, escribe SQL y encola link

import { mkdir, readdir } from "node:fs/promises";
import {
  type Category,
  NORMALIZER_VERSION,
  NormalizationOutputSchema,
  outputSchema,
  SOURCE_TEXT_MAX,
} from "@framerate/contracts";
import { listingIdentityFrom } from "@framerate/matching";
import { SYSTEM } from "@framerate/matching/normalize";
import { $ } from "bun";

const ACCOUNT = "3f50a4a123ebcbcb917dababff3ef8b5";
const LINK_QUEUE = process.env.LINK_QUEUE_ID ?? "";
const MODEL = "claude-haiku-5-5/subagente";
const BATCH = 30;
const DB_DIR = new URL("../../../packages/database/", import.meta.url).pathname;

interface Row {
  id: number;
  category: Category;
  title: string;
  raw_title: string | null;
  brand: string | null;
  mpn: string | null;
  gtin: string | null;
  source_text: string | null;
  norm_hash: string;
  store: string;
}

async function d1<T>(sql: string): Promise<T[]> {
  const out = await $`bunx wrangler d1 execute framerate --remote --json --command ${sql}`.cwd(DB_DIR).quiet().text();
  return JSON.parse(out)[0].results as T[];
}

const SELECT = `SELECT l.id, l.category, l.title, l.raw_title, l.brand, l.mpn, l.gtin, l.source_text, l.norm_hash,
  s.name store FROM listings l JOIN stores s ON s.id = l.store_id`;

async function exportBatches(dir: string, categories: string[], normalized: number) {
  const list = categories.map((c) => `'${c}'`).join(",");
  // --normalized N: piloto sobre ofertas que ya normalizó la API, para comparar.
  const rows = normalized
    ? await d1<Row>(`${SELECT} JOIN listing_identity i ON i.listing_id = l.id AND i.input_hash = l.norm_hash
        WHERE i.model = 'claude-haiku-5-5' AND l.category IN (${list}) ORDER BY random() LIMIT ${normalized}`)
    : await d1<Row>(`${SELECT} WHERE l.is_active = 1 AND l.norm_hash IS NOT NULL AND l.norm_status != 'pending'
        AND l.category IN (${list}) AND NOT EXISTS (SELECT 1 FROM listing_identity i WHERE i.listing_id = l.id
        AND i.version = ${NORMALIZER_VERSION} AND i.input_hash = l.norm_hash) ORDER BY l.category, l.id`);
  await mkdir(`${dir}/in`, { recursive: true });
  await mkdir(`${dir}/out`, { recursive: true });
  await Bun.write(`${dir}/system.md`, SYSTEM);
  for (const c of new Set(rows.map((r) => r.category))) {
    await Bun.write(`${dir}/schema-${c}.json`, JSON.stringify(outputSchema(c)));
  }
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((r) => ({
      listingId: r.id,
      hash: r.norm_hash,
      input: {
        store: r.store,
        declared_category: r.category,
        title: r.raw_title ?? r.title,
        declared_brand: r.brand,
        mpn: r.mpn,
        gtin: r.gtin,
        description: r.source_text ? r.source_text.slice(0, SOURCE_TEXT_MAX) : null,
      },
    }));
    await Bun.write(`${dir}/in/${String(i / BATCH).padStart(3, "0")}.json`, JSON.stringify(batch, null, 1));
  }
  console.log(`${rows.length} ofertas en ${Math.ceil(rows.length / BATCH)} tandas`);
}

const sqlText = (v: string | null) => (v === null ? "NULL" : `'${v.replaceAll("'", "''")}'`);

/** Respuestas de los subagentes. Las escribió un modelo: el id entra a SQL sólo si es un entero positivo. */
async function readAnswers(dir: string): Promise<Map<number, unknown>> {
  const answers = new Map<number, unknown>();
  for (const f of (await readdir(`${dir}/out`)).filter((f) => f.endsWith(".json"))) {
    const entries: unknown = await Bun.file(`${dir}/out/${f}`).json();
    if (!Array.isArray(entries)) continue;
    for (const a of entries as { listingId?: unknown; output?: unknown }[]) {
      if (Number.isSafeInteger(a?.listingId) && (a.listingId as number) > 0)
        answers.set(a.listingId as number, a.output);
    }
  }
  return answers;
}

async function importBatches(dir: string) {
  const answers = await readAnswers(dir);
  const ids = new Set(answers.keys());
  // Hash con el que se exportó cada oferta (los archivos de entrada no los toca el subagente).
  const exported = new Map<number, string>();
  for (const f of (await readdir(`${dir}/in`)).filter((f) => f.endsWith(".json"))) {
    for (const b of (await Bun.file(`${dir}/in/${f}`).json()) as { listingId: number; hash: string }[]) {
      exported.set(b.listingId, b.hash);
    }
  }
  if (ids.size === 0) return console.log("sin respuestas");
  // El hash y el texto se releen de la base: si la oferta cambió desde la exportación, se descarta.
  const rows = await d1<Row>(`${SELECT} WHERE l.id IN (${[...ids].join(",")})`);
  const at = new Date().toISOString();
  const statements: string[] = [];
  const linked: number[] = [];
  const problems: Record<string, number[]> = {};
  const fail = (why: string, id: number) => {
    problems[why] ??= [];
    problems[why].push(id);
  };
  for (const r of rows) {
    if (exported.get(r.id) !== r.norm_hash) {
      fail("changed", r.id);
      continue;
    }
    const raw = answers.get(r.id) as { category?: string } | undefined;
    // Como el Worker: si Haiku corrigió la categoría, vale el esquema de la nueva.
    const schemaCategory = (raw?.category && raw.category !== "other" ? raw.category : r.category) as Category;
    const parsed = NormalizationOutputSchema(schemaCategory).safeParse(raw);
    if (!parsed.success) {
      fail("invalid", r.id);
      continue;
    }
    const output = parsed.data;
    const title = r.raw_title ?? r.title;
    const { identity, anchored } = listingIdentityFrom(output, {
      category: r.category,
      title,
      sourceText: r.source_text,
      brand: r.brand,
      mpn: r.mpn,
    });
    if (!identity) {
      fail("other", r.id);
      continue;
    }
    const specs: Record<string, unknown> = {};
    const specsSource: Record<string, "text" | "knowledge"> = {};
    const fromKnowledge = new Set(output.specs_from_knowledge);
    for (const [field, value] of Object.entries(output.specs)) {
      if (value === null) continue;
      specs[field] = value;
      specsSource[field] = fromKnowledge.has(field) ? "knowledge" : "text";
    }
    const identityRaw = {
      category: output.category,
      category_reason: output.category_reason,
      brand: output.brand,
      mpn: output.mpn,
      condition: output.condition,
      confidence: output.confidence,
      identity: output.identity,
      identity_from_mpn: output.identity_from_mpn,
      identity_from_knowledge: output.identity_from_knowledge,
      dropped: anchored.dropped,
      from_mpn: anchored.fromMpn,
    };
    statements.push(
      `INSERT INTO listing_identity (listing_id, version, input_hash, model, category, brand, name, mpn, confidence,
        identity, identity_raw, specs, specs_source, created_at) VALUES (${r.id}, ${NORMALIZER_VERSION},
        ${sqlText(r.norm_hash)}, ${sqlText(MODEL)}, ${sqlText(identity.category)}, ${sqlText(identity.brand)},
        ${sqlText(identity.name)}, ${sqlText(identity.mpn)}, ${sqlText(identity.confidence)},
        ${sqlText(JSON.stringify(identity.identity))}, ${sqlText(JSON.stringify(identityRaw))},
        ${sqlText(JSON.stringify(specs))}, ${sqlText(JSON.stringify(specsSource))}, ${sqlText(at)})
        ON CONFLICT (listing_id, version) DO NOTHING;`,
      `UPDATE listings SET norm_status = 'normalized', norm_at = ${sqlText(at)} WHERE id = ${r.id};`,
    );
    linked.push(r.id);
  }
  for (const id of ids) if (!rows.some((r) => r.id === id)) fail("missing", id);
  const file = `${dir}/import.sql`;
  await Bun.write(file, statements.join("\n"));
  if (statements.length) await $`bunx wrangler d1 execute framerate --remote --file ${file} --yes`.cwd(DB_DIR).quiet();
  // La sombra del vínculo la hace framerate-match con su propio código, como con cualquier otra oferta.
  if (LINK_QUEUE && linked.length) {
    const token = (await $`bunx wrangler auth token`.quiet().text()).trim().split("\n").at(-1);
    for (let i = 0; i < linked.length; i += 100) {
      const messages = linked
        .slice(i, i + 100)
        .map((listingId) => ({ body: { listingId, version: NORMALIZER_VERSION, reason: "backfill" } }));
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/queues/${LINK_QUEUE}/messages/batch`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
        },
      );
      if (!res.ok) throw new Error(`cola framerate-link: ${res.status} ${await res.text()}`);
    }
  }
  console.log(JSON.stringify({ imported: linked.length, problems }));
}

/** Piloto: identidad anclada del subagente contra la que guardó la API para la misma oferta. No escribe nada. */
async function compareBatches(dir: string) {
  const answers = await readAnswers(dir);
  if (answers.size === 0) return console.log("sin respuestas");
  const rows = await d1<Row & { api_identity: string; api_category: string; api_brand: string; api_name: string }>(
    `${SELECT.replace("s.name store", "s.name store, i.identity api_identity, i.category api_category, i.brand api_brand, i.name api_name")}
     JOIN listing_identity i ON i.listing_id = l.id AND i.model = 'claude-haiku-5-5' WHERE l.id IN (${[...answers.keys()].join(",")})`,
  );
  let same = 0;
  const diffs: string[] = [];
  for (const r of rows) {
    const raw = answers.get(r.id) as { category?: string };
    const cat = (raw?.category && raw.category !== "other" ? raw.category : r.category) as Category;
    const parsed = NormalizationOutputSchema(cat).safeParse(raw);
    if (!parsed.success) {
      diffs.push(`${r.id} inválido: ${parsed.error.issues[0]?.message}`);
      continue;
    }
    const { identity } = listingIdentityFrom(parsed.data, {
      category: r.category,
      title: r.raw_title ?? r.title,
      sourceText: r.source_text,
      brand: r.brand,
      mpn: r.mpn,
    });
    const sub = JSON.stringify(identity?.identity ?? null);
    const api = JSON.stringify(JSON.parse(r.api_identity));
    const key = (o: Record<string, unknown> | null) => JSON.stringify(Object.entries(o ?? {}).sort());
    const equal =
      key(identity?.identity ?? null) === key(JSON.parse(r.api_identity)) &&
      identity?.category === r.api_category &&
      identity?.brand === r.api_brand;
    if (equal) same++;
    else
      diffs.push(`${r.id} ${r.raw_title ?? r.title}\n   api: ${r.api_brand} ${api}\n   sub: ${identity?.brand} ${sub}`);
  }
  console.log(`${same}/${rows.length} identidades iguales\n${diffs.join("\n")}`);
}

const [cmd, dir, arg, flag, n] = process.argv.slice(2);
if (cmd === "export" && dir && arg) await exportBatches(dir, arg.split(","), flag === "--normalized" ? Number(n) : 0);
else if (cmd === "import" && dir) await importBatches(dir);
else if (cmd === "compare" && dir) await compareBatches(dir);
else console.log("uso: export <dir> <categorías> [--normalized N] | import <dir> | compare <dir>");
