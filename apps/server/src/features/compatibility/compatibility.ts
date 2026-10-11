import type { Category, CompatCheck, CompatRule, QuoteCompatibility } from "@framerate/contracts";

/**
 * Verificador de compatibilidad de una cotización (#127, docs/specs/2026-10-11-compatibilidad.md). Dominio puro: recibe
 * los ítems seleccionados con sus datos ya fusionados (identidad + specs) y devuelve un chequeo por regla aplicable.
 * Desconocido nunca es incompatible: lo que un normalizador no reconoce queda `null`.
 */

export interface Part {
  itemId: number;
  name: string;
  category: Category;
  quantity: number;
  facts: Record<string, unknown>;
}

type Parts = Partial<Record<Category, Part>>;
type Rule = (p: Parts) => CompatCheck | null;

const check = (rule: CompatRule, result: CompatCheck["result"], parts: Part[], message: string): CompatCheck => ({
  rule,
  result,
  itemIds: parts.map((p) => p.itemId),
  message,
});
const unknown = (rule: CompatRule, parts: Part[], what: string, of: Part) =>
  check(rule, "unknown", parts, `No sabemos ${what} de ${of.name}.`);

// --- Normalizadores del texto libre que devuelve Haiku -------------------------------------------------------------

export function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

const bool = (v: unknown) => (v === true || v === 1 ? true : v === false || v === 0 ? false : null);

/** "LGA 1700", "FCLGA1700", "S1700", 1700 → "lga1700"; "am5" → "am5". */
export function socket(v: unknown): string | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const s = String(v)
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  const amd = s.match(/^(?:socket)?(am[2-5]\+?|strx?\d|sp\d|fm\d\+?)$/);
  if (amd?.[1]) return amd[1];
  // ponytail: "lga1151v2" cae en "lga1151"; las dos generaciones de 1151 no se distinguen (plataforma de 2017).
  const lga = s.match(/^(?:fc)?(?:lga|s|socket)?(\d{3,4})(?:v\d)?$/);
  return lga ? `lga${lga[1]}` : null;
}

/** Lista de sockets de un cooler: "1200/1700/AM4", "LGA 115x / AM5". Vacía (p. ej. "Intel/AMD") = desconocida. */
export function sockets(v: unknown): Set<string> | null {
  if (typeof v !== "string") return null;
  const out = new Set<string>();
  for (const [token] of v.toLowerCase().matchAll(/am[2-5]\+?|strx?\d|115x|\d{3,4}/g)) {
    if (token === "115x") for (const n of [1150, 1151, 1155, 1156]) out.add(`lga${n}`);
    else out.add(/^\d/.test(token) ? `lga${token}` : token);
  }
  return out.size > 0 ? out : null;
}

/** "DDR4, DDR5-5600" → {ddr4, ddr5}; "ddr3l" → {ddr3}. */
export function memoryTypes(v: unknown): Set<string> | null {
  if (typeof v !== "string") return null;
  const out = new Set([...v.toLowerCase().matchAll(/ddr\s*([345])/g)].map((m) => `ddr${m[1]}`));
  return out.size > 0 ? out : null;
}
const memoryType = (v: unknown) => [...(memoryTypes(v) ?? [])][0] ?? null;

const BOARD_SIZES = ["itx", "matx", "atx", "eatx"] as const;
const boardSize = (token: string) => {
  const t = token.toLowerCase();
  if (/e-?_?atx|extended|eeb/.test(t)) return 3;
  if (/micro|m-?_?atx|µ|uatx/.test(t)) return 1;
  if (/itx/.test(t)) return 0;
  if (/atx/.test(t)) return 2;
  return null;
};
/** El formato de placa más grande que acepta un gabinete: uno ATX también recibe mATX e ITX. */
export function largestBoard(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const sizes = v.split(/[,/;]|\sy\s|\sand\s/).flatMap((t) => boardSize(t) ?? []);
  return sizes.length > 0 ? Math.max(...sizes) : null;
}

/** El radiador más grande que acepta un gabinete: "front 360, top 240" → 360. */
export function largestRadiator(v: unknown): number | null {
  if (typeof v === "number") return num(v);
  if (typeof v !== "string") return null;
  const sizes = [...v.matchAll(/\d{3}/g)].map(Number).filter((n) => [120, 140, 240, 280, 360, 420, 480].includes(n));
  return sizes.length > 0 ? Math.max(...sizes) : null;
}

const label = (s: string) => s.toUpperCase();

// --- Reglas --------------------------------------------------------------------------------------------------------

const RULES: Rule[] = [
  ({ cpu, motherboard: mb }) => {
    if (!cpu || !mb) return null;
    const a = socket(cpu.facts.socket);
    const b = socket(mb.facts.socket);
    if (!a) return unknown("socket", [cpu, mb], "el socket", cpu);
    if (!b) return unknown("socket", [cpu, mb], "el socket", mb);
    return a === b
      ? check("socket", "ok", [cpu, mb], `El procesador y la placa usan socket ${label(a)}.`)
      : check("socket", "incompatible", [cpu, mb], `El procesador es ${label(a)} y la placa ${label(b)}: no calzan.`);
  },

  ({ ram, motherboard: mb }) => {
    if (!ram || !mb) return null;
    const a = memoryType(ram.facts.type);
    const b = memoryType(mb.facts.memory_type);
    if (!a) return unknown("memory_type", [ram, mb], "el tipo de memoria", ram);
    if (!b) return unknown("memory_type", [ram, mb], "qué memoria usa", mb);
    return a === b
      ? check("memory_type", "ok", [ram, mb], `La RAM y la placa son ${label(a)}.`)
      : check("memory_type", "incompatible", [ram, mb], `La RAM es ${label(a)} y la placa usa ${label(b)}.`);
  },

  ({ ram, cpu, motherboard: mb }) => {
    if (!ram || !cpu) return null;
    const a = memoryType(ram.facts.type);
    const b = memoryTypes(cpu.facts.memory_types);
    // Con placa, `memory_type` ya responde; esto sólo agrega cuando sí sabemos qué soporta el procesador.
    if (!a || !b) return mb ? null : unknown("memory_type_cpu", [ram, cpu], "qué memoria soporta", cpu);
    return b.has(a)
      ? check("memory_type_cpu", "ok", [ram, cpu], `El procesador soporta ${label(a)}.`)
      : check(
          "memory_type_cpu",
          "incompatible",
          [ram, cpu],
          `El procesador sólo soporta ${[...b].map(label).join(" y ")} y la RAM es ${label(a)}.`,
        );
  },

  ({ ram, motherboard: mb }) => {
    if (!ram || !mb) return null;
    const ff = ram.facts.form_factor;
    if (ff === "dimm") return check("memory_form_factor", "ok", [ram, mb], "La RAM es DIMM, el formato de escritorio.");
    if (ff === "sodimm")
      return check(
        "memory_form_factor",
        "warning",
        [ram, mb],
        "La RAM es SO-DIMM (de notebook): casi ninguna placa de escritorio la acepta.",
      );
    return unknown("memory_form_factor", [ram, mb], "el formato", ram);
  },

  ({ ram, motherboard: mb }) => {
    if (!ram || !mb) return null;
    const perKit = num(ram.facts.modules);
    const slots = num(mb.facts.memory_slots);
    if (!perKit) return unknown("memory_slots", [ram, mb], "cuántos módulos trae", ram);
    if (!slots) return unknown("memory_slots", [ram, mb], "cuántos slots de memoria tiene", mb);
    const modules = perKit * ram.quantity;
    return modules <= slots
      ? check("memory_slots", "ok", [ram, mb], `Son ${modules} módulos y la placa tiene ${slots} slots.`)
      : check(
          "memory_slots",
          "incompatible",
          [ram, mb],
          `Son ${modules} módulos y la placa sólo tiene ${slots} slots.`,
        );
  },

  ({ motherboard: mb, case: box }) => {
    if (!mb || !box) return null;
    const board = typeof mb.facts.form_factor === "string" ? boardSize(mb.facts.form_factor) : null;
    const max = largestBoard(box.facts.supported_motherboard_form_factors);
    if (board === null) return unknown("board_case", [mb, box], "el formato", mb);
    if (max === null) return unknown("board_case", [mb, box], "qué placas acepta", box);
    const name = label(BOARD_SIZES[board] ?? "");
    return board <= max
      ? check("board_case", "ok", [mb, box], `La placa ${name} entra en el gabinete.`)
      : check(
          "board_case",
          "incompatible",
          [mb, box],
          `La placa es ${name} y el gabinete llega hasta ${label(BOARD_SIZES[max] ?? "")}.`,
        );
  },

  ({ gpu, case: box }) => {
    if (!gpu || !box) return null;
    const len = num(gpu.facts.length_mm);
    const max = num(box.facts.max_gpu_length_mm);
    if (!len) return unknown("gpu_length", [gpu, box], "el largo", gpu);
    if (!max) return unknown("gpu_length", [gpu, box], "el largo máximo de tarjeta", box);
    return len <= max
      ? check("gpu_length", "ok", [gpu, box], `La tarjeta mide ${len} mm y el gabinete admite hasta ${max} mm.`)
      : check("gpu_length", "incompatible", [gpu, box], `La tarjeta mide ${len} mm y el gabinete admite ${max} mm.`);
  },

  ({ cpu_cooler: cooler, case: box }) => {
    if (!cooler || !box || cooler.facts.type !== "air") return null;
    const h = num(cooler.facts.height_mm);
    const max = num(box.facts.max_cpu_cooler_height_mm);
    if (!h) return unknown("cooler_height", [cooler, box], "el alto", cooler);
    if (!max) return unknown("cooler_height", [cooler, box], "el alto máximo de cooler", box);
    return h <= max
      ? check("cooler_height", "ok", [cooler, box], `El cooler mide ${h} mm y el gabinete admite hasta ${max} mm.`)
      : check("cooler_height", "incompatible", [cooler, box], `El cooler mide ${h} mm y el gabinete admite ${max} mm.`);
  },

  ({ cpu_cooler: cooler, case: box }) => {
    if (!cooler || !box || cooler.facts.type !== "aio") return null;
    const rad = num(cooler.facts.radiator_mm);
    const max = largestRadiator(box.facts.radiator_support_mm);
    if (!rad) return unknown("radiator", [cooler, box], "el tamaño del radiador", cooler);
    if (!max) return unknown("radiator", [cooler, box], "qué radiadores acepta", box);
    return rad <= max
      ? check("radiator", "ok", [cooler, box], `El radiador de ${rad} mm entra en el gabinete.`)
      : check("radiator", "incompatible", [cooler, box], `El radiador es de ${rad} mm y el gabinete admite ${max} mm.`);
  },

  ({ cpu, cpu_cooler: cooler }) => {
    if (!cpu || !cooler) return null;
    const s = socket(cpu.facts.socket);
    const list = sockets(cooler.facts.sockets);
    if (!s) return unknown("cooler_socket", [cpu, cooler], "el socket", cpu);
    if (!list) return unknown("cooler_socket", [cpu, cooler], "qué sockets soporta", cooler);
    // Advertencia y no incompatible: muchos coolers suman sockets con un kit aparte y no lo listan.
    return list.has(s)
      ? check("cooler_socket", "ok", [cpu, cooler], `El cooler soporta ${label(s)}.`)
      : check(
          "cooler_socket",
          "warning",
          [cpu, cooler],
          `El cooler no lista ${label(s)} entre sus sockets: revisa si trae o vende el soporte.`,
        );
  },

  ({ cpu, cpu_cooler: cooler }) => {
    if (!cpu || cooler) return null;
    const included = bool(cpu.facts.includes_cooler);
    if (included === null) return unknown("cooler_missing", [cpu], "si trae cooler", cpu);
    return included
      ? check("cooler_missing", "ok", [cpu], "El procesador trae su cooler.")
      : check("cooler_missing", "warning", [cpu], "El procesador no trae cooler: agrega uno a la cotización.");
  },

  ({ psu, cpu, gpu }) => {
    if (!psu || (!cpu && !gpu)) return null;
    const involved = [psu, cpu, gpu].filter((p): p is Part => p !== undefined);
    const watts = num(psu.facts.wattage);
    if (!watts) return unknown("psu_wattage", involved, "la potencia", psu);
    let need = 75;
    for (const p of [cpu, gpu]) {
      if (!p) continue;
      const tdp = num(p.facts.tdp_w);
      if (!tdp) return unknown("psu_wattage", involved, "el consumo", p);
      need += tdp * p.quantity;
    }
    if (watts < need)
      return check(
        "psu_wattage",
        "incompatible",
        involved,
        `La fuente es de ${watts} W y el equipo consume unos ${need} W.`,
      );
    if (watts < need * 1.25)
      return check(
        "psu_wattage",
        "warning",
        involved,
        `La fuente de ${watts} W queda justa para unos ${need} W de consumo: conviene un 25 % de margen.`,
      );
    return check("psu_wattage", "ok", involved, `La fuente de ${watts} W cubre los ${need} W estimados.`);
  },
];

const SEVERITY = { ok: 0, unknown: 1, warning: 2, incompatible: 3 } as const;
const STATUS = { ok: "valid", unknown: "unknown", warning: "warning", incompatible: "incompatible" } as const;

/** `parts`: sólo los ítems seleccionados. En los slots aditivos (almacenamiento, ventiladores) no hay reglas. */
export function checkCompatibility(parts: readonly Part[]): QuoteCompatibility {
  const byCategory: Parts = {};
  for (const p of parts) byCategory[p.category] ??= p;
  const checks = RULES.flatMap((rule) => rule(byCategory) ?? []);
  if (checks.length === 0) return { status: "unknown", checks };
  const worst = checks.reduce((a, c) => (SEVERITY[c.result] > SEVERITY[a.result] ? c : a));
  return { status: STATUS[worst.result], checks };
}
