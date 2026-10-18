/**
 * Referencia de tarjetas de video por chipset (#180). AMD y NVIDIA se bajan sin navegador; Intel ARK corta sin él, así
 * que sus fichas de Arc se bajan con Playwright (#207) y quedan en
 * gpu-reference.intel.json:
 *
 *   bun scripts/gpu-reference.ts build      baja AMD y NVIDIA, suma Intel y escribe gpu-reference.json
 *   bun scripts/gpu-reference.ts sql > /tmp/gpu-reference.sql
 *   cd ../../packages/database && bunx wrangler d1 execute framerate --remote --file /tmp/gpu-reference.sql
 *
 * Y para completar lo ya normalizado, sin llamar a Haiku:
 *   bunx wrangler d1 execute framerate --remote --json --command "select listing_id, version, identity, specs,
 *     specs_source from listing_identity where category = 'gpu'" | bun ../../apps/normalize/scripts/gpu-reference.ts
 *     backfill > /tmp/gpu-backfill.sql
 */
import {
  chipsetKey,
  chipsetNumber,
  fillFromGpuReference,
  type GpuReference,
  pickGpuReference,
} from "../src/gpu-reference";

const DATA = new URL("./gpu-reference.json", import.meta.url).pathname;
const AMD_URL = "https://www.amd.com/en/products/specifications/graphics.html";
const NVIDIA = "https://www.nvidia.com/en-us/geforce/graphics-cards";
// Las series que tienen página con tabla de specs; la 16, la 20 y las GT no la tienen.
const NVIDIA_FAMILIES = [
  "50-series/rtx-5090",
  "50-series/rtx-5080",
  "50-series/rtx-5070-family",
  "50-series/rtx-5060-family",
  "50-series/rtx-5050",
  "40-series/rtx-4090",
  "40-series/rtx-4080-family",
  "40-series/rtx-4070-family",
  "40-series/rtx-4060-4060ti",
  "30-series/rtx-3090-3090ti",
  "30-series/rtx-3080-3080ti",
  "30-series/rtx-3070-3070ti",
  "30-series/rtx-3060-3060ti",
  "30-series/rtx-3050",
];
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";

const int = (s: unknown) => {
  const m = String(s ?? "").match(/\d+/);
  return m ? Number(m[0]) : null;
};
const first = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined;

/**
 * "AMD Radeon™ RX 9070 XT" y "AMDRadeonRX9070XT" → "rx 9070 xt"; "GeForce RTX 5070 Ti" → "rtx 5070 ti";
 * "GeForce RTX 3050 (8 GB)" → "rtx 3050 8gb" (variantes con consumo distinto: se buscan con la memoria primero).
 */
export const canonicalChipset = (name: string) => {
  const vram = name.match(/\((\d+)\s*GB\)/i)?.[1];
  const base = name
    .replace(/[®™]|&trade;/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/^(AMD\s*)?Radeon\s*/i, "")
    .replace(/^(NVIDIA\s*)?GeForce\s*/i, "")
    .replace(/^(RX|RTX|GTX|PRO)\s*/i, "$1 ")
    .replace(/(\d)\s*(XTX|XT|GRE|Ti|SUPER)\b/gi, "$1 $2")
    .replace(/\b(Ti)\s*(SUPER)\b/gi, "$1 $2");
  return chipsetKey(vram ? `${base} ${vram}gb` : base);
};

// AMD no pone la arquitectura en la tabla, pero la publica por serie.
const AMD_ARCHITECTURE: [RegExp, string][] = [
  [/RX 9\d{3}/, "RDNA 4"],
  [/RX 7\d{3}|PRO W7/, "RDNA 3"],
  [/RX 6\d{3}|PRO W6/, "RDNA 2"],
  [/RX 5\d{3}\b|PRO W5/, "RDNA"],
  [/RX [45]\d{2}\b/, "Polaris"],
];

/** Una tarjeta del JSON de la página de especificaciones de AMD (`data-json`). */
export function fromAmd(title: string, s: Record<string, unknown>): GpuReference | null {
  if (!/Desktop|Component/.test(String(s["Board Type"] ?? ""))) return null;
  const memory = first(s["Memory Type"]);
  const name = String(s.Name ?? title).replace(/[®™]|&trade;/g, "");
  const chipset = canonicalChipset(name);
  // Fuera los de notebook ("r9 m280", "hd 8570m series gpu") y los OEM sin serie ("520").
  if (!/^[a-z]/.test(chipset) || /\bm\d|\dm\b|series gpu/.test(chipset)) return null;
  return {
    chipset,
    brand: "amd",
    name,
    number: chipsetNumber(chipset),
    architecture: AMD_ARCHITECTURE.find(([re]) => re.test(chipset.toUpperCase()))?.[1] ?? null,
    launch: first(s["Launch Date"]) ?? null,
    shader_cores: int(first(s["Stream Processors"])),
    board_power_w: int(s["Typical Board Power (Desktop)"]),
    min_psu_w: int(s["Minimum PSU Recommendation"]),
    power_connectors: first(s["Additional Power Connector"]) ?? null,
    memory_type: memory ? memory.toUpperCase() : null,
    vram_gb: int(s["Max Memory Size"]) ? [int(s["Max Memory Size"]) as number] : [],
    memory_bus_bit: int(s["Memory Interface"]),
    pcie_version: first(s["Bus Type"])?.match(/\d\.\d/)?.[0] ?? null,
    reference_length_mm: null,
    source_url: AMD_URL,
  };
}

const cellText = (s: string) =>
  s
    .replace(/<sup>[\s\S]*?<\/sup>/g, "")
    .replace(/<br\s*\/?>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&amp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * La tabla de specs de una página de familia de NVIDIA: una columna por modelo. La etiqueta de cada fila va en la
 * primera o en la segunda celda según la página; los valores son lo que sigue. Las páginas de un solo modelo no
 * tienen encabezado con el nombre: sale de la URL ("rtx-5090").
 */
export function fromNvidia(html: string, url: string): GpuReference[] {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) =>
    [...(m[1] ?? "").matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => cellText(c[1] ?? "")),
  );
  const row = (label: RegExp) => {
    for (const r of rows) {
      const at = r.findIndex((c, i) => i < 2 && label.test(c));
      if (at >= 0) return r.slice(at + 1);
    }
    return [];
  };
  const power = row(/^(Total Graphics Power|Graphics Card Power)/i);
  if (power.length === 0) return [];
  // En las páginas de un modelo el nombre sale de la URL: la de la 5080 trae una columna "RTX 4090" de comparación.
  const slug = url.match(/(rtx-\d{4})\/?$/)?.[1]?.replace("-", " ");
  const header = rows.find((r) => r.filter((c) => /GeForce RTX/.test(c)).length === power.length);
  const names =
    slug && power.length === 1
      ? [`GeForce ${slug.toUpperCase()}`]
      : (header?.filter((c) => /GeForce RTX/.test(c)) ?? []);
  const psu = row(/^Required System Power/i);
  const connectors = row(/^(Supplementary )?Power Connectors/i);
  const memory = row(/^Standard Memory Config/i);
  const bus = row(/^Memory Interface Width/i);
  const length = row(/^Length$/i);
  const architecture = row(/^(Shader Cores|NVIDIA Architecture|GPU Architecture)$/i);
  const cores = row(/^NVIDIA CUDA.? Cores$/i);
  const pcie = rows.flat().find((c) => /^PCI Express Gen \d$/i.test(c));
  return names.flatMap((name, i) => {
    const mem = memory[i] ?? "";
    const chipset = canonicalChipset(name);
    // "350 / 320" con "12 GB / 10 GB": una fila por variante de memoria; el chipset solo queda con el mayor.
    const watts = [...(power[i] ?? "").matchAll(/\d+/g)].map((m) => Number(m[0]));
    const gbs = [...mem.matchAll(/(\d+)\s*GB/g)].map((m) => Number(m[1]));
    const variants =
      watts.length > 1 && watts.length === gbs.length ? gbs.map((gb, k) => [gb, watts[k] ?? null] as const) : [];
    const base = {
      chipset,
      brand: "nvidia" as const,
      name,
      number: chipsetNumber(chipset),
      architecture: architecture[i]?.match(/Blackwell|Ada Lovelace|Ampere|Turing|Hopper/i)?.[0] ?? null,
      launch: null,
      shader_cores: int(cores[i]),
      board_power_w: watts.length > 0 ? Math.max(...watts) : null,
      min_psu_w: int(psu[i]),
      power_connectors: connectors[i] || null,
      memory_type: mem.match(/G?DDR\d+X?/i)?.[0].toUpperCase() ?? null,
      vram_gb: [...new Set([...mem.matchAll(/(\d+)\s*GB/g)].map((m) => Number(m[1])))],
      memory_bus_bit: int(bus[i]),
      pcie_version: pcie?.match(/Gen (\d)/i)?.[1] ? `${pcie.match(/Gen (\d)/i)?.[1]}.0` : null,
      reference_length_mm: Number(length[i]?.match(/(\d+(?:\.\d+)?)\s*mm/)?.[1]) || null,
      source_url: url,
    };
    return [
      base,
      ...variants.map(([gb, w]) => ({ ...base, chipset: `${chipset} ${gb}gb`, vram_gb: [gb], board_power_w: w })),
    ];
  });
}

/** Una ficha de Intel ARK de una Arc de escritorio. Las A-series y las B-series nombran distinto la memoria. */
export function fromIntelArc(name: string, url: string, s: Record<string, string>): GpuReference {
  const chipset = canonicalChipset(
    name
      .replace(/Specifications$/, "")
      .replace(/Intel\s*|Graphics/gi, "")
      .replace(/Arc\s+/i, "arc "),
  );
  const memory = s.Memory ?? `${s["Memory Size"] ?? ""} ${s["Memory Type"] ?? ""}`;
  const vram = int(memory.match(/(\d+)\s*GB/)?.[1]);
  return {
    chipset,
    brand: "intel",
    name: name
      .replace(/Specifications$/, "")
      .replace(/[®™]/g, "")
      .replace(/\s+/g, " ")
      .trim(),
    number: chipsetNumber(chipset),
    architecture: s.Microarchitecture ?? null,
    launch: s["Launch Date"] ?? null,
    shader_cores: int(s["Xe-cores"]),
    board_power_w: int(s.TBP),
    min_psu_w: int(s["Minimum Power Supply Unit"]),
    power_connectors: s["Power Connectors"] ?? null,
    memory_type: memory.match(/G?DDR\d+X?/i)?.[0].toUpperCase() ?? null,
    vram_gb: vram ? [vram] : [],
    memory_bus_bit: int(s["Graphics Memory Interface"]),
    pcie_version: s["PCI Express Configurations ‡"]?.match(/\d\.\d/)?.[0] ?? null,
    reference_length_mm: int(s["Dimensions (Length x Width)"]),
    source_url: url,
  };
}

const q = (v: unknown) =>
  v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replaceAll("'", "''")}'`;

const fetchText = async (url: string) => {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
};

const [mode] = process.argv.slice(2);
if (import.meta.main && mode === "build") {
  const rows = new Map<string, GpuReference>();
  const amdHtml = await fetchText(AMD_URL);
  const raw = amdHtml.match(/data-json="([^"]*)"/)?.[1] ?? "";
  const json = raw
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  const items = (
    JSON.parse(json) as { items: { title: string; elements: Record<string, { title: string; value?: unknown }> }[] }
  ).items;
  for (const it of items) {
    const specs = Object.fromEntries(Object.values(it.elements).map((e) => [e.title, e.value]));
    const r = fromAmd(it.title, specs);
    if (r) rows.set(r.chipset, r);
  }
  const intel = JSON.parse(await Bun.file(new URL("./gpu-reference.intel.json", import.meta.url).pathname).text()) as {
    name: string;
    url: string;
    specs: Record<string, string>;
  }[];
  for (const card of intel) {
    const r = fromIntelArc(card.name, card.url, card.specs);
    // La A770 viene en 8 y 16 GB con el mismo consumo: una fila con las dos capacidades.
    const prev = rows.get(r.chipset);
    rows.set(
      r.chipset,
      prev ? { ...r, vram_gb: [...new Set([...prev.vram_gb, ...r.vram_gb])].sort((a, b) => a - b) } : r,
    );
  }
  for (const family of NVIDIA_FAMILIES) {
    const url = `${NVIDIA}/${family}/`;
    const found = fromNvidia(await fetchText(url), url);
    if (found.length === 0) console.error(`sin tabla: ${url}`);
    for (const r of found) rows.set(r.chipset, r);
  }
  const sorted = [...rows.values()].sort((a, b) => a.chipset.localeCompare(b.chipset));
  await Bun.write(DATA, `${JSON.stringify(sorted, null, 1)}\n`);
  console.error(`${sorted.length} chipsets (${sorted.filter((r) => r.brand === "amd").length} AMD)`);
} else if (import.meta.main && mode === "sql") {
  const rows = JSON.parse(await Bun.file(DATA).text()) as GpuReference[];
  const cols = Object.keys(rows[0] ?? {}) as (keyof GpuReference)[];
  console.log("DELETE FROM gpu_reference;");
  for (const r of rows) {
    const values = cols.map((c) => (c === "vram_gb" ? q(JSON.stringify(r[c])) : q(r[c])));
    console.log(`INSERT INTO gpu_reference (${cols.join(", ")}) VALUES (${values.join(", ")});`);
  }
  console.error(`${rows.length} chipsets`);
} else if (import.meta.main && mode === "backfill") {
  const refs = JSON.parse(await Bun.file(DATA).text()) as GpuReference[];
  const input = await Bun.stdin.text();
  const rows = (JSON.parse(input.slice(input.indexOf("["))) as { results: Record<string, string | number>[] }[])[0]
    ?.results as { listing_id: number; version: number; identity: string; specs: string; specs_source: string }[];
  let n = 0;
  for (const row of rows) {
    const identity = JSON.parse(row.identity) as Record<string, string>;
    const ref = pickGpuReference(refs, String(identity.chipset ?? ""), identity.vram_gb);
    if (!ref) continue;
    const before = row.specs;
    const { specs, source } = fillFromGpuReference(JSON.parse(row.specs), JSON.parse(row.specs_source), ref);
    if (JSON.stringify(specs) === JSON.stringify(JSON.parse(before))) continue;
    n++;
    console.log(
      `UPDATE listing_identity SET specs = ${q(JSON.stringify(specs))}, specs_source = ${q(JSON.stringify(source))} WHERE listing_id = ${row.listing_id} AND version = ${row.version};`,
    );
  }
  console.error(`${n} de ${rows.length} identidades completadas`);
} else if (import.meta.main) {
  throw new Error("uso: build | sql | backfill");
}
