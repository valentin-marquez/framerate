/**
 * Calidad de fuentes de poder (#177): lectura de la tier list externa y vínculo de una fuente del catálogo con su fila.
 * Uso interno: el tier decide la regla `psu_tier`, nunca se muestra ni se nombra la fuente de los datos.
 */

export interface PsuTierRow {
  brand: string;
  series: string;
  subseries: string;
  variant: string;
  wattages: number[];
  tier: string;
  limited: boolean;
  year: number | null;
  formFactor: string | null;
  atxVersion: string | null;
  modular: string | null;
  efficiency: string | null;
  odm: string;
  platform: string;
  notes: string;
}

/** Minúsculas y sólo letras y números: "be quiet!" → "bequiet", "ATX 3.1" → "atx31". */
export const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Claves con que una marca de la planilla calza con la del catálogo: "Antec/Atom" → antecatom, antec, atom;
 * "ADATA XPG" → adataxpg, adata, xpg. Sirven para `psu_tier.brand_key`, separadas por espacios.
 */
export function brandKeys(brand: string): string[] {
  const parts = [brand, ...brand.split(/[/()\n]/), ...brand.split(/[\s/()]+/)];
  return [...new Set(parts.map(compact).filter((k) => k.length >= 2))];
}

// Valores de la planilla en el vocabulario de las specs de fuente (`PsuSpecsSchema`).
const FORM_FACTOR: Record<string, string> = { ATX: "atx", SFX: "sfx", "SFX-L": "sfx_l", Flex: "flex", Other: "other" };
const MODULAR: Record<string, string> = { Full: "full", Semi: "semi", No: "none" };
const EFFICIENCY: Record<string, string> = {
  W: "white",
  B: "bronze",
  S: "silver",
  G: "gold",
  P: "platinum",
  T: "titanium",
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field || row.length > 0) rows.push([...row, field]);
  return rows;
}

/**
 * La pestaña "Full List" exportada como CSV. Marca, serie, subserie y variante sólo vienen en la primera fila de su
 * grupo (celdas combinadas): la primera columna con dato marca el nivel, y lo de arriba se hereda de la fila anterior.
 */
export function parsePsuTiers(csv: string): PsuTierRow[] {
  const out: PsuTierRow[] = [];
  let prev = ["", "", "", ""];
  for (const cells of parseCsv(csv).slice(1)) {
    const c = cells.map((x) => x.trim());
    const tier = (c[5] ?? "").match(/^([A-F][+-]?)(\*)?$/);
    const wattages = [...(c[4] ?? "").matchAll(/\d{3,4}/g)].map((m) => Number(m[0]));
    if (!tier?.[1] || wattages.length === 0) continue;
    const level = [0, 1, 2, 3].findIndex((i) => c[i]);
    const names = level === -1 ? prev : [...prev.slice(0, level), ...[0, 1, 2, 3].slice(level).map((i) => c[i] ?? "")];
    prev = names;
    const [brand = "", series = "", subseries = "", variant = ""] = names;
    if (!brand || !series) continue;
    out.push({
      brand,
      series,
      subseries,
      variant: variant === "-" ? "" : variant,
      wattages,
      tier: tier[1],
      limited: tier[2] === "*",
      year: Number.parseInt(c[6] ?? "", 10) || null,
      formFactor: FORM_FACTOR[c[7] ?? ""] ?? null,
      atxVersion: c[8]?.match(/\d\.x/i)?.[0].toLowerCase() ?? null,
      modular: MODULAR[c[10] ?? ""] ?? null,
      efficiency: EFFICIENCY[c[11] ?? ""] ?? null,
      odm: c[15] ?? "",
      platform: c[16] ?? "",
      notes: c[17] ?? "",
    });
  }
  return out;
}

export interface PsuTier {
  tier: string;
  limited: boolean;
}

type Candidate = Pick<PsuTierRow, "series" | "subseries" | "variant" | "wattages" | "tier" | "limited">;

const letter = (tier: string) => tier[0] ?? "F";
const worst = (rows: Candidate[]) => rows.reduce((a, b) => (letter(b.tier) > letter(a.tier) ? b : a));

/**
 * Las palabras de un nombre de la planilla que tienen que estar en el del producto: sin paréntesis, comillas ni años
 * (las tiendas no ponen "2021"; si dos filas sólo difieren en el año, quedan empatadas y sin tier).
 */
const words = (s: string) =>
  s
    .replace(/\([^)]*\)|"/g, " ")
    .split(/\s+/)
    .map(compact)
    .filter((w) => w.length >= 2 && w !== "series" && !/^(19|20)\d\d$/.test(w));

/**
 * La fila de una fuente del catálogo entre las de su marca: la serie tiene que estar en el nombre y la potencia en la
 * fila. Si subserie y variante también están en el nombre gana la fila más específica. Lo que queda ambiguo sólo se
 * acepta si todas las filas dan la misma letra, y entonces se toma la peor; si no, `null`: sin tier nunca es malo.
 */
export function matchPsuTier(name: string, wattage: number | null, rows: readonly Candidate[]): PsuTier | null {
  const watts = wattage ?? Number(name.match(/(\d{3,4})\s*w\b/i)?.[1] ?? 0);
  if (!watts) return null;
  // La planilla escribe el modelo sin la potencia: "UD-GM" es UD850GM, "RM-x" es RM850x.
  const texts = [compact(name), compact(name.replaceAll(String(watts), " "))];
  const has = (s: string) => words(s).every((w) => texts.some((t) => t.includes(w)));
  const pool = rows.filter((r) => r.wattages.includes(watts) && words(r.series).length > 0 && has(r.series));
  if (pool.length === 0) return null;
  const specificity = (r: Candidate) => [r.series, r.subseries, r.variant].flatMap(words).join("").length;
  const strict = pool.filter((r) => has(r.subseries) && has(r.variant));
  const top = Math.max(...strict.map(specificity));
  const picked = strict.length > 0 ? strict.filter((r) => specificity(r) === top) : pool;
  if (new Set(picked.map((r) => letter(r.tier))).size > 1) return null;
  const w = worst(picked);
  return { tier: w.tier, limited: picked.some((r) => r.limited) };
}
