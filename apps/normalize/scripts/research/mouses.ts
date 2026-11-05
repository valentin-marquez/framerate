// Medidas de mouses desde las fichas oficiales (#218): junta las URLs de los sitemaps de cada marca, baja cada ficha y
// le pide a Haiku por API las medidas y los modelos del catálogo que corresponden a esa ficha. Lo bloqueado se salta.
// Uso, desde apps/normalize: bun scripts/research/mouses.ts <dir> [marca,marca] [máximo de fichas]
// Deja <dir>/mouses-<marcas>.json para `bun scripts/part-reference.ts build mouse <dir>/mouses-*.json`.
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { resolveBrand } from "@framerate/matching";
import { $ } from "bun";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";
const DB_DIR = fileURLToPath(new URL("../../../../packages/database/", import.meta.url));
const MODEL = "claude-haiku-5-5";

const SYSTEM = `You extract the physical data of one computer mouse from text taken from its official manufacturer page.
Reply only with a JSON object: {"is_mouse": boolean, "model": string, "length_mm": number|null, "width_mm": number|null,
"height_mm": number|null, "weight_g": number|null, "shape": string|null, "hand": string|null, "catalog_models": string[]}.
- is_mouse: false for keyboards, combos, mousepads, receivers, accessories and anything that is not one mouse or trackball.
- model: the official name without the brand.
- length_mm is front to back, width_mm side to side, height_mm from the desk up, whatever the page calls each axis
  (a page may say "Height" or "Depth" for the front to back side). Convert to millimeters. If the page gives two values
  for an axis (front and back), use the larger one. Never estimate: null when the page does not state it.
- weight_g: the mouse alone, without cable or receiver.
- shape: symmetrical, ergonomic, asymmetrical or vertical, only if the page says so; hand: right, left or ambidextrous,
  only if the page says so. Otherwise null.
- catalog_models: from the list given, every entry that is exactly this product, in any color or spelling. Do not include
  a different generation or edition: "G502 X" is not "G502 Hero", and "Viper V3 Pro" is not "Viper V2 Pro".`;

const locs = async (url: string) => {
  const xml = await fetch(url, { headers: { "user-agent": UA } }).then((r) => r.text());
  return [...xml.matchAll(/<loc>([^<]+)/g)].map((m) => (m[1] ?? "").replaceAll("&amp;", "&"));
};

/** Sólo el texto con datos: el HTML de estas fichas pesa más de 1 MB, casi todo scripts. */
export function specText(html: string) {
  const title = html.match(/<title[^>]*>([^<]*)/i)?.[1] ?? "";
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/\\u([0-9a-f]{4})/gi, (_, c) => String.fromCharCode(Number.parseInt(c, 16)))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  const hits = text.matchAll(
    /\d\s?(mm|in\b|g\b|grams?\b|oz\b)|ambidextrous|right[- ]hand|left[- ]hand|symmetrical|ergonomic/gi,
  );
  const parts = new Set<string>();
  let end = 0;
  for (const hit of hits) {
    if (hit.index < end) continue;
    end = hit.index + 90;
    parts.add(text.slice(Math.max(0, hit.index - 90), end));
  }
  return `${title}\n${[...parts].join("\n")}`.slice(0, 12_000);
}

async function sources(): Promise<{ brand: string; url: string }[]> {
  const logitech = [
    ...(await locs("https://www.logitechg.com/sitemap.xml")),
    ...(await locs("https://www.logitech.com/sitemap.xml")),
  ].filter(
    (u) =>
      /\/en-us\/shop\/p\//.test(u) &&
      !/keys|keyboard|combo|desk|headset|webcam|pad|bundle|cover|receiver|skates|grip-tape/.test(u) &&
      /mouse|mice|trackball|lift|mx-|pebble|superlight|ergo-|\/g\d{3}|\/m\d{3}/.test(u),
  );
  const razerMaps = (await locs("https://www.razer.com/sitemap.xml")).filter((u) => u.includes("Product-en-US"));
  const razer = (await Promise.all(razerMaps.map(locs)))
    .flat()
    .filter((u) => /\/gaming-mice\//.test(u))
    .map((u) =>
      u
        .replace(/^(https:\/\/[^/]+)\/[a-z]{2}-[a-z]{2}\//i, "$1/")
        .replace(/[?#].*$/, "")
        .replace(/\/p\/[^/]+$|\/RZ[^/]+$/i, ""),
    );
  const steelMaps = (await locs("https://steelseries.com/sitemap.xml")).filter((u) =>
    /\/sitemap-products\.xml$/.test(u),
  );
  const steel = (await Promise.all(steelMaps.map(locs)))
    .flat()
    .filter((u) => /\/gaming-mice\/[^/?]+/.test(u))
    .map((u) => `https://steelseries.com/gaming-mice/${u.match(/\/gaming-mice\/([^/?]+)/)?.[1]}`);
  const nested = async (index: string, maps: RegExp) => {
    const lists = (await locs(index)).filter((u) => maps.test(u));
    return (await Promise.all(lists.map(locs))).flat();
  };
  const notMouse =
    /keyboard|headset|mouse-?pad|mousepad|desk-?mat|keycap|microphone|bundle|combo|gift|sleeve|skates|cable|webcam/i;
  const kensington = (await locs("https://www.kensington.com/kensingtonsitemap.xml")).filter(
    (u) => /^https:\/\/www\.kensington\.com\/p\/products\//.test(u) && /mice|trackball|mouse/i.test(u),
  );
  const fantech = (await nested("https://fantechworld.com/sitemap.xml", /sitemap_products/)).filter(
    (u) => /\/products\//.test(u) && !notMouse.test(u),
  );
  const hyperx = (await nested("https://hyperx.com/sitemap.xml", /sitemap_products/)).filter(
    (u) => /\/products\/.*(mouse|pulsefire)/i.test(u) && !notMouse.test(u),
  );
  const corsair = (await nested("https://www.corsair.com/us-sitemap.xml", /us-sitemap-products/)).filter(
    (u) => /mouse|mice/i.test(u) && !notMouse.test(u),
  );
  return [
    ...[...new Set(kensington)].map((url) => ({ brand: "Kensington", url })),
    ...[...new Set(fantech)].map((url) => ({ brand: "Fantech", url })),
    ...[...new Set(hyperx)].map((url) => ({ brand: "Kingston", url })),
    ...[...new Set(corsair)].map((url) => ({ brand: "Corsair", url })),
    ...[...new Set(logitech)].map((url) => ({ brand: "Logitech", url })),
    ...[...new Set(razer)].map((url) => ({ brand: "Razer", url })),
    ...[...new Set(steel)].map((url) => ({ brand: "SteelSeries", url })),
  ];
}

/** Los modelos que escribe el catálogo por marca, para que Haiku diga cuáles son esta ficha. */
async function catalogModels() {
  const out = await $`bunx wrangler d1 execute framerate --remote --json --command ${`SELECT DISTINCT
    json_extract(i.identity, '$.model') model, l.brand declared, coalesce(l.raw_title, l.title) title
    FROM listing_identity i JOIN listings l ON l.id = i.listing_id
    WHERE i.category = 'mouse' AND l.is_active = 1 AND json_extract(i.identity, '$.model') IS NOT NULL`}`
    .cwd(DB_DIR)
    .quiet()
    .text();
  const rows = JSON.parse(out)[0].results as { model: string; declared: string | null; title: string }[];
  const byBrand = new Map<string, Set<string>>();
  for (const r of rows) {
    const brand = resolveBrand({ category: "mouse", title: r.title, brand: r.declared });
    if (brand) byBrand.set(brand, (byBrand.get(brand) ?? new Set()).add(r.model));
  }
  return byBrand;
}

if (import.meta.main) {
  const [dir, brands, max] = process.argv.slice(2);
  if (!dir) throw new Error("uso: mouses.ts <dir> [marca,marca] [máximo de fichas]");
  const vars = await Bun.file(new URL("../../.dev.vars", import.meta.url).pathname)
    .text()
    .catch(() => "");
  const apiKey = process.env.ANTHROPIC_API_KEY ?? vars.match(/ANTHROPIC_API_KEY=(.+)/)?.[1]?.trim();
  if (!apiKey) throw new Error("falta ANTHROPIC_API_KEY");
  const client = new Anthropic({ apiKey });

  const wanted = brands?.split(",");
  const all = (await sources()).filter((s) => !wanted || wanted.includes(s.brand));
  const count: Record<string, number> = {};
  for (const s of all) count[s.brand] = (count[s.brand] ?? 0) + 1;
  console.error(JSON.stringify(count));
  const list = max ? all.filter((_, i) => i % Math.ceil(all.length / Number(max)) === 0) : all;
  const catalog = await catalogModels();

  const rows: Record<string, unknown>[] = [];
  const skipped: string[] = [];
  let next = 0;
  let tokens = 0;
  const worker = async () => {
    while (next < list.length) {
      const source = list[next++];
      if (!source) break;
      try {
        const res = await fetch(source.url, {
          headers: { "user-agent": UA, "accept-language": "en" },
          signal: AbortSignal.timeout(25_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const models = [...(catalog.get(source.brand) ?? [])].join(", ");
        const r = await client.messages.create({
          model: MODEL,
          max_tokens: 1500,
          system: SYSTEM,
          messages: [{ role: "user", content: `Catalog list: ${models}\n\nPage text:\n${specText(await res.text())}` }],
        });
        tokens += r.usage.input_tokens + r.usage.output_tokens;
        const raw = r.content.find((c) => c.type === "text")?.text ?? "";
        const row = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
        if (row.is_mouse) rows.push({ ...row, brand: source.brand, source_url: source.url });
      } catch (error) {
        skipped.push(`${source.url}: ${(error as Error).message}`);
      }
      // Las marcas responden 429 si se va más rápido: se respeta y lo saltado se reintenta otro día.
      await Bun.sleep(1500);
    }
  };
  await Promise.all(Array.from({ length: 2 }, worker));
  await Bun.write(`${dir}/mouses-${brands ?? "todas"}.json`, JSON.stringify(rows, null, 1));
  console.error(`${rows.length} mouses de ${list.length} fichas, ${skipped.length} saltadas, ${tokens} tokens`);
  for (const s of skipped.slice(0, 15)) console.error(s);
}
