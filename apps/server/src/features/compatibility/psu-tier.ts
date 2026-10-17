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
 * "650/750/850W" es una lista; "550-850W" es un rango (una de cada cinco filas) y cubre las potencias comerciales de
 * por medio. ponytail: de 50 en 50 W, que es como se venden; una 460 W dentro de un rango no calzaría.
 */
export function parseWattages(cell: string): number[] {
  const out = new Set<number>();
  for (const m of cell.matchAll(/(\d{3,4})(?:\s*W)?\s*-\s*(\d{3,4})/g)) {
    const [from, to] = [Number(m[1]), Number(m[2])];
    out.add(from).add(to);
    for (let w = Math.ceil(from / 50) * 50; w < to; w += 50) out.add(w);
  }
  for (const m of cell.matchAll(/\d{3,4}/g)) out.add(Number(m[0]));
  return [...out].sort((a, b) => a - b);
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
    const wattages = parseWattages(c[4] ?? "");
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
  /** La peor nota posible; `best` la mejor. Son distintas cuando la planilla separa por revisión o año y la tienda no
   * lo dice (Corsair CX650 de 2016 o de 2023): la regla sólo decide si todo el rango da la misma respuesta. */
  tier: string;
  best: string;
  limited: boolean;
}

type Candidate = Pick<PsuTierRow, "series" | "subseries" | "variant" | "wattages" | "tier" | "limited">;

const letter = (tier: string) => tier[0] ?? "F";
/** A+ < A < A- < B+ … < F: menor es mejor. */
const rank = (tier: string) => "ABCDEF".indexOf(letter(tier)) * 3 + (tier[1] === "+" ? 0 : tier[1] === "-" ? 2 : 1);
const worst = (rows: Candidate[]) => rows.reduce((a, b) => (rank(b.tier) > rank(a.tier) ? b : a));
const best = (rows: Candidate[]) => rows.reduce((a, b) => (rank(b.tier) < rank(a.tier) ? b : a));

// Palabras que describen y no distinguen: las tiendas casi nunca las escriben ("GSK ATX 3.1", "Global", "Modular").
const SOFT = new Set([
  "atx",
  "30",
  "31",
  "modular",
  "fully",
  "full",
  "semi",
  "mod",
  "non",
  "standard",
  "global",
  "version",
  "ver",
  "edition",
]);
// La eficiencia y el color sí tienen que estar, pero no desempatan: "H Bronze" no es más específica que "DC".
const WEAK = new Set(["bronze", "silver", "gold", "platinum", "titanium", "white", "black"]);

/** Como `compact`, pero el "+" cuenta: "G+" de EVGA no es "G". */
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9+]/g, "");

/**
 * Las formas en que una tienda puede escribir un nombre de la planilla: lo de fuera de los paréntesis o la abreviatura
 * de dentro ("Cuprum Strike (CSK)" es CSK, "Gold (NE-G)" es NE650G). Cada forma es la lista de palabras que tienen que
 * estar; sin años (las tiendas no ponen "2021": dos filas que sólo difieren en el año quedan empatadas y sin tier).
 */
const forms = (s: string) => {
  const toWords = (t: string) =>
    t
      .replace(/"/g, " ")
      .split(/\s+/)
      .map(key)
      .filter((w) => w.length >= 2 && w !== "series" && !/^(19|20)\d\d$/.test(w));
  const outside = toWords(s.replace(/\([^)]*\)/g, " "));
  const inside = [...s.matchAll(/\(([^)]*)\)/g)].map((m) => toWords(m[1] ?? "")).filter((f) => f.length > 0);
  return [outside, ...inside];
};
const required = (words: string[]) => words.filter((w) => !SOFT.has(w));

/**
 * La fila de una fuente del catálogo entre las de su marca: la serie tiene que estar en el nombre y la potencia en la
 * fila. Si subserie y variante también están en el nombre gana la fila más específica. Lo que queda empatado devuelve
 * el rango de notas (`tier` la peor, `best` la mejor). Sin fila, `null`: sin tier nunca es malo.
 */
export function matchPsuTier(name: string, wattage: number | null, rows: readonly Candidate[]): PsuTier | null {
  const watts = wattage ?? Number(name.match(/(\d{3,4})\s*w\b/i)?.[1] ?? 0);
  if (!watts) return null;
  // "80 Plus" no es la variante "Plus"; la planilla escribe el modelo sin la potencia ("UD-GM" es UD850GM).
  const clean = name.replace(/80\s*(\+|plus)/gi, " ");
  const variants = [clean, clean.replaceAll(String(watts), "")];
  const texts = variants.map(key);
  const tokens = new Set(variants.flatMap((v) => v.split(/[\s\-/_]+/).map(key)));
  // Lo corto va al comienzo de una palabra ("NE" en "NE650G", "GF" en "GF1": ahí desempata la fila más específica), no
  // en cualquier parte ("GF" no está en "TGF"); lo largo puede ir pegado ("CSK" en "CSK650").
  const present = (w: string) =>
    w.length <= 3 ? [...tokens].some((t) => t.startsWith(w)) : texts.some((t) => t.includes(w));
  // Lo de dentro del paréntesis es sólo una alternativa: si lo de fuera no exige nada ("2013 (Green Label)", "(rev.
  // 2.0)") la fila pasa, y una abreviatura de una letra no reemplaza al nombre ("Bronze (B)").
  const has = (s: string) => {
    const [outside = [], ...inside] = forms(s).map(required);
    if (outside.length === 0) return true;
    return [outside, ...inside].some((f) => f.length > 0 && f.every(present));
  };
  // "C Series" (NZXT) o "B Series" (EVGA): la letra tiene que ir pegada a la potencia, "C850" o "750 BQ".
  const series = (s: string) => {
    if (forms(s).some((f) => required(f).length > 0)) return has(s);
    const letter = compact(s)[0];
    return !!letter && new RegExp(`\\b${letter}\\s?-?${watts}|${watts}\\s?${letter}`, "i").test(clean);
  };
  const specificity = (r: Candidate) =>
    [r.series, r.subseries, r.variant]
      .flatMap((s) => forms(s).flat())
      .filter((w) => !WEAK.has(w) && present(w))
      .join("").length;
  const pool = rows.filter((r) => r.wattages.includes(watts) && series(r.series));
  if (pool.length === 0) return null;
  const strict = pool.filter((r) => has(r.subseries) && has(r.variant));
  const top = Math.max(...strict.map(specificity));
  const picked = strict.length > 0 ? strict.filter((r) => specificity(r) === top) : pool;
  return { tier: worst(picked).tier, best: best(picked).tier, limited: picked.some((r) => r.limited) };
}
