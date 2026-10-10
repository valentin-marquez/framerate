import {
  CATEGORIES,
  type Category,
  type Confidence,
  IDENTITY_FIELDS,
  type IdentitySource,
  type IdentityValue,
  type ListingIdentity,
} from "@framerate/contracts";
import { ATTRIBUTE_DEFAULTS, type Attributes, identityAttributeName, PROFILES, prep } from "./attributes";
import { canonicalBrand } from "./brands";
import { freeTextFields } from "./decide";
import { resolveBrand } from "./fingerprint";
import { normalizeMpn } from "./identifiers";
import { titleTraits } from "./traits";
import { aliasesOf, canonicalText } from "./vocabulary";

/**
 * Anclaje de la identidad que devuelve Haiku (spec 2026-10-08 §2): un campo entra a la identidad sólo si aparece en
 * el título o la ficha, o lo reproduce un decodificador de MPN nuestro. Una alucinación positiva que coincide con
 * otro producto es la única fusión errónea nueva posible; sin rastro en el texto, el valor no existe.
 */

export interface AnchorInput {
  category: Category;
  title: string;
  sourceText?: string | null;
  /** Marca y MPN del campo de la tienda. */
  brand?: string | null;
  mpn?: string | null;
}

export interface AnchorResult {
  /** Sólo lo anclado, con valores normalizados (minúsculas, separadores a espacio, colores canónicos). */
  identity: Record<string, IdentityValue>;
  /** Devueltos por Haiku sin rastro en el texto ni en el MPN. */
  dropped: string[];
  /** Confirmados por un decodificador de MPN. */
  fromMpn: string[];
  /** Lo que Haiku declaró como conocimiento propio: pista para el prompt, no verdad. */
  knowledge: string[];
  confidence: Confidence;
}

const isCategory = (c: string): c is Category => (CATEGORIES as readonly string[]).includes(c);

const identityBrand = (category: Category, raw: IdentitySource, input: AnchorInput) =>
  resolveBrand({ category, title: input.title, brand: canonicalBrand(raw.brand) ?? input.brand });

export function anchorIdentity(raw: IdentitySource, input: AnchorInput): AnchorResult {
  const category = isCategory(raw.category) ? raw.category : input.category;
  const brand = identityBrand(category, raw, input);
  const title = prep(input.title);
  const text = input.sourceText ? prep(input.sourceText) : "";
  const decoded = decodeMpn(category, normalizeMpn(input.mpn) ?? normalizeMpn(raw.mpn));
  const titleAttributes = PROFILES[category].extract(input.title);
  const identity: Record<string, IdentityValue> = {};
  const dropped: string[] = [];
  const fromMpn: string[] = [];
  let confidence = raw.confidence;
  for (const field of IDENTITY_FIELDS[category]) {
    const value = normalizeValue(category, field, raw.identity[field] ?? null);
    if (value === null) continue;
    const where = anchor(category, brand, field, value, title, text, decoded, titleAttributes);
    // La ficha puede ser de otro producto (medido: "SSD Patriot Elite" con la ficha del Burst): el título manda.
    if (where === "text" && contradictsTitle(category, field, value, titleAttributes)) {
      dropped.push(field);
      confidence = "low";
      continue;
    }
    if (!where) {
      dropped.push(field);
      continue;
    }
    if (where === "mpn") fromMpn.push(field);
    identity[field] = value;
  }
  // Después del anclaje: la forma canónica puede no estar escrita en el título ("vengeance lpx" con "Corsair LPX").
  const rawLine = identity.line;
  for (const field of freeTextFields(category)) {
    const value = identity[field];
    if (typeof value === "string") identity[field] = canonicalText(category, brand, field, value);
  }
  dedupeAcrossFields(identity, rawLine);
  // Lo que separa SKU hermanos y ningún campo tiene (pantalla, versión, kit de servidor): del título, no de Haiku.
  Object.assign(identity, titleTraits(category, input.title));
  return { identity, dropped, fromMpn, knowledge: raw.identity_from_knowledge, confidence };
}

/** Identidad lista para guardar y para `fingerprintFromIdentity`; null si Haiku dijo que no es de ninguna categoría. */
export function listingIdentityFrom(
  raw: IdentitySource,
  input: AnchorInput,
): { identity: ListingIdentity | null; anchored: AnchorResult } {
  const anchored = anchorIdentity(raw, input);
  if (!isCategory(raw.category)) return { identity: null, anchored };
  const category = raw.category;
  const brand = identityBrand(category, raw, input);
  // Un MPN sólo cuenta si está impreso: en el título, la ficha o el campo de la tienda.
  const printed = normalizeMpn(raw.mpn);
  const haystack = compact(
    `${prep(input.title)} ${input.sourceText ? prep(input.sourceText) : ""} ${prep(input.mpn ?? "")}`,
  );
  const mpn = printed && haystack.includes(printed.toLowerCase()) ? printed : null;
  return {
    identity: { category, brand, name: raw.name, mpn, confidence: anchored.confidence, identity: anchored.identity },
    anchored,
  };
}

// ─── Valores ─────────────────────────────────────────────────────────────────

const VALUE_ALIASES: Record<string, Record<string, string>> = {
  color: {
    negro: "black",
    negra: "black",
    bk: "black",
    blanco: "white",
    blanca: "white",
    wh: "white",
    snow: "white",
    rosa: "pink",
    rosado: "pink",
    rojo: "red",
    roja: "red",
    azul: "blue",
    gris: "gray",
    grey: "gray",
    verde: "green",
    morado: "purple",
    lila: "purple",
    plata: "silver",
    plateado: "silver",
  },
  efficiency: { bronce: "bronze", platino: "platinum", platinium: "platinum" },
  form_factor: {
    "micro atx": "matx",
    microatx: "matx",
    "m atx": "matx",
    uatx: "matx",
    "mini itx": "itx",
    "e atx": "eatx",
    "m2 2280": "2280",
    "m.2 2280": "2280",
    "m2 2230": "2230",
    "m.2 2230": "2230",
    "m2 2242": "2242",
    "m.2 2242": "2242",
    "2 5": "2.5",
    "3 5": "3.5",
  },
  modular: {
    "fully modular": "full",
    "full modular": "full",
    "semi modular": "semi",
    "non modular": "none",
    "no modular": "none",
  },
};

// Kingston escribe la línea con la familia ("Fury Beast", "HyperX Fury"); RGB tiene campo propio.
const RAM_FAMILY_WORDS = new Set(["kingston", "fury", "hyperx", "rgb"]);

function normalizeValue(category: Category, field: string, value: IdentityValue | null): IdentityValue | null {
  if (value === null || typeof value !== "string") return value;
  const prepped = prep(value).trim();
  if (!prepped) return null;
  const v = VALUE_ALIASES[field]?.[prepped] ?? prepped;
  // Mismo formato que el extractor por título: chipset sin el sufijo de formato, variante del vocabulario de hoy.
  if (category === "motherboard" && field === "chipset") return v.match(/^[abhxz]\d{3}e?/)?.[0] ?? v;
  if (category === "motherboard" && field === "variant") return v.match(/\b(max ii|ii|max|csm)\b/)?.[1] ?? null;
  if (category === "ram" && field === "line") {
    return (
      v
        .split(" ")
        .filter((t) => !RAM_FAMILY_WORDS.has(t))
        .join(" ") || null
    );
  }
  return v;
}

// Lo que ya tiene campo propio (memoria, wifi, OC, revisión) o pertenece a `line` no distingue dentro de `model` ni
// `variant`: Haiku lo reparte distinto en cada llamada ("TUF GAMING B850M-PLUS WIFI" contra "B850M Plus WiFi").
const OWN_FIELD_TOKENS = /^(?:ddr[345]|d[45]|wi|fi\d?|wifi[a-z0-9]*|6e|ax|ac|oc|edition|r\d(?:\.\d)?|ii|max|csm)$/;

// Con la línea de Haiku y la canónica: "TUF Gaming" deja "tuf", pero "gaming" tampoco va en el modelo.
function dedupeAcrossFields(identity: Record<string, IdentityValue>, rawLine: IdentityValue | undefined): void {
  const lineTokens = new Set([identity.line, rawLine].flatMap((l) => (typeof l === "string" ? l.split(" ") : [])));
  for (const field of ["model", "variant"]) {
    const value = identity[field];
    if (typeof value !== "string") continue;
    const tokens = value.split(" ");
    // "WIFI 7" con espacio deja el 7 suelto; el wifi y su versión tienen campo propio.
    const wifiVersion = (t: string, i: number) => /^\d$/.test(t) && /^(?:fi|wifi)$/.test(tokens[i - 1] ?? "");
    const kept = tokens.filter(
      (t, i) => !lineTokens.has(t) && !(field === "model" && (OWN_FIELD_TOKENS.test(t) || wifiVersion(t, i))),
    );
    const cleaned = field === "variant" ? kept.filter((t) => !/^(?:oc|edition)$/.test(t)) : kept;
    if (cleaned.length) identity[field] = cleaned.join(" ");
    else delete identity[field];
  }
}

// ─── Dónde aparece ───────────────────────────────────────────────────────────

type Where = "title" | "mpn" | "text" | null;

function anchor(
  category: Category,
  brand: string | null,
  field: string,
  value: IdentityValue,
  title: string,
  text: string,
  decoded: Decoded,
  regex: Attributes,
): Where {
  if (found(field, value, title)) return "title";
  const free = typeof value === "string" && freeTextFields(category).includes(field) ? value : null;
  if (free && foundCanonical(category, brand, field, free, title)) return "title";
  if (decoded[field] === value) return "mpn";
  // El extractor de hoy también decodifica el título (B760M → matx, 4800 MT/s → ddr5); sus valores por defecto no
  // son evidencia y los booleanos sólo cuentan con token.
  const attr = identityAttributeName(field);
  if (typeof value !== "boolean" && regex[attr] === value && ATTRIBUTE_DEFAULTS[category]?.[attr] !== value) {
    return "title";
  }
  if (text && found(field, value, text)) return "text";
  if (free && text && foundCanonical(category, brand, field, free, text)) return "text";
  return null;
}

// Haiku copia la forma canónica que le mostramos ("gammix d35" con el título "XPG D35"): cuenta si el texto, reescrito
// con las mismas reglas, la contiene, o si trae un alias que lleva a ella.
function foundCanonical(category: Category, brand: string | null, field: string, value: string, text: string): boolean {
  const canonical = canonicalText(category, brand, field, value);
  return (
    formInText(canonical, canonicalText(category, brand, field, text.trim())) ||
    aliasesOf(category, brand, canonical).some((a) => formInText(a, text))
  );
}

function found(field: string, value: IdentityValue, text: string): boolean {
  if (typeof value === "boolean") return BOOLEAN_TOKENS[field]?.[value ? "yes" : "no"]?.test(text) ?? false;
  if (typeof value === "number") return numberPatterns(field, value).some((re) => re.test(text));
  const pattern = STRING_PATTERNS[field]?.[value];
  if (pattern) return pattern.test(text);
  return stringForms(field, value).some((form) => formInText(form, text));
}

// Sobre texto `prep`: sólo [a-z0-9+.] y espacios, con espacio en los bordes.
const BOOLEAN_TOKENS: Record<string, { yes: RegExp; no: RegExp | null }> = {
  oc: { yes: / (?:oc|oced|overclocked|overclock) | o\d{1,2}gb? /, no: null },
  wifi: {
    yes: / (?<!(?:sin|no|non|without) )(?:wi ?fi[a-z0-9]*|ax\d?|ac) /,
    no: / (?:sin|no|non|without) wi ?fi /,
  },
  // Sin límite por delante: "FuryBeastRGB" y "ARGB" cuentan.
  rgb: { yes: /(?<!(?:sin|no|non|without) )rgb /, no: / (?:sin|no|non|without) a?rgb / },
  ecc: { yes: / (?<!(?:sin|no|non|without) )ecc /, no: / (?:sin|no|non|without) ecc | nonecc / },
  registered: {
    yes: / (?:registered|reg|rdimm|ecc reg) /,
    no: / (?:unbuffered|udimm|u dimm|unregistered|non ?reg) /,
  },
};

/** `n` seguido de una unidad opcional (u obligatoria) y límite de palabra: "16gb", "16 gb", "6000mhz", "cx750". */
const bounded = (body: string) => new RegExp(`(?<![a-z0-9.])${body}(?![a-z0-9])`);
const withUnit = (n: number, units: string, required = false) =>
  bounded(`${n}(?: ?(?:${units}))${required ? "" : "?"}`);

function numberPatterns(field: string, n: number): RegExp[] {
  switch (field) {
    case "capacity_gb":
    case "vram_gb": {
      const patterns = [withUnit(n, "gb|g|gbs", true)];
      if (n >= 1000 && n % 1000 === 0) {
        patterns.push(withUnit(n / 1000, "tb|t", true), withUnit((n / 1000) * 1024, "gb|g", true));
      }
      return patterns;
    }
    case "speed_mt_s":
      return [withUnit(n, "mhz|mt s|mts|mt|mh|mhs")];
    case "wattage":
      return [withUnit(n, "w|watts|watt|wats")];
    case "rpm": {
      const patterns = [withUnit(n, "rpm|rmp|r")];
      if (n % 100 === 0) patterns.push(bounded(`${n / 1000}k(?: ?rpm)?`));
      return patterns;
    }
    case "radiator_mm":
    case "size_mm":
      return [withUnit(n, "mm|m")];
    case "cas_latency":
      return [
        bounded(`cl ?${n}`),
        new RegExp(`\\dc${n}(?![0-9])`),
        bounded(`cas(?: latency)? ?${n}`),
        bounded(`${n} \\d{1,2} \\d{1,2}`),
      ];
    case "pcie_gen":
      return [
        bounded(`(?:pcie|pci e|pci express|pcle|pci|nvme) ?(?:gen ?)?${n}(?:\\.0)?`),
        bounded(`gen ?${n}`),
        bounded(`${n}\\.0`),
      ];
    case "modules":
      return [
        bounded(`${n} ?x ?\\d{1,3}`),
        bounded(`\\d{1,3} ?gb? ?x ?${n}`),
        bounded(`kit ?(?:de |of )?${n}`),
        bounded(`${n} ?(?:modulos|modules|module|modulo|sticks|stick|dimms|dimm|unidades|piezas|pcs)`),
        ...(n === 1 ? [bounded("single")] : []),
      ];
    case "quantity":
      return [
        bounded(`${n} ?x ?\\d{2,3}`),
        bounded(`x ?${n}`),
        bounded(`(?:pack|kit) ?(?:de |of )?${n}`),
        bounded(`${n} ?(?:pack|pcs|pz|piezas|unidades|units|fans|ventiladores|en 1|in 1)`),
      ];
    default:
      return [bounded(String(n))];
  }
}

/** Formas en que el texto escribe un valor canónico (ya pasadas por `prep`). */
const STRING_FORMS: Record<string, Record<string, string[]>> = {
  form_factor: {
    matx: ["matx", "micro atx", "microatx", "m atx", "uatx"],
    itx: ["itx", "mini itx"],
    eatx: ["eatx", "e atx", "extended atx"],
    dimm: ["dimm", "udimm", "u dimm", "288 pin", "288p"],
    sodimm: ["sodimm", "so dimm", "260 pin", "262 pin"],
    "2280": ["2280"],
    "2230": ["2230"],
    "2242": ["2242"],
    "2.5": ["2.5"],
    "3.5": ["3.5"],
    "mid tower": ["mid tower", "midtower", "media torre"],
    "full tower": ["full tower", "torre completa"],
    "mini tower": ["mini tower", "mini torre"],
    sff: ["sff", "small form factor"],
  },
  interface: { nvme: ["nvme", "pcie", "pci e", "pci express"], sata: ["sata", "sata3", "sata iii"], sas: ["sas"] },
  efficiency: {
    gold: ["gold", "oro"],
    bronze: ["bronze", "bronce"],
    silver: ["silver", "plata"],
    platinum: ["platinum", "platino", "platinium"],
    titanium: ["titanium", "titanio"],
    white: ["white", "80 plus", "80+", "80plus"],
  },
  color: {
    black: ["black", "negro", "negra", "bk"],
    white: ["white", "blanco", "blanca", "wh", "snow"],
    pink: ["pink", "rosa", "rosado"],
    red: ["red", "rojo", "roja"],
    blue: ["blue", "azul"],
    gray: ["gray", "grey", "gris"],
    green: ["green", "verde"],
    purple: ["purple", "morado", "morada", "lila"],
    silver: ["silver", "plata", "plateado", "plateada"],
  },
  type: {
    ddr4: ["ddr4", "d4"],
    ddr5: ["ddr5", "d5"],
    aio: ["aio", "liquid", "liquida", "liquido", "water", "all in one"],
    air: ["air", "aire", "torre", "tower", "disipador"],
  },
  memory_type: { ddr4: ["ddr4", "d4"], ddr5: ["ddr5", "d5"] },
  packaging: {
    box: ["box", "boxed", "caja", "retail"],
    tray: ["tray", "oem", "bulk"],
    "box with cooler": ["with cooler", "con cooler", "incluye cooler", "wraith", "cooler incluido"],
  },
};

// Valores que dependen del contexto: "Modular" a secas es full; "semi modular" y "no modular" lo niegan.
const STRING_PATTERNS: Record<string, Record<string, RegExp>> = {
  modular: {
    full: /(?<! (?:semi|no|non|sin|not) )modular /,
    semi: / semi ?modular /,
    none: / (?:no|non|sin|not) ?modular /,
  },
};

const stringForms = (field: string, value: string) => STRING_FORMS[field]?.[value] ?? [value];
const compact = (s: string) => s.replace(/[^a-z0-9+]/g, "");

/** Todos los tokens del valor están en el texto ("rtx 5070 ti"), o el valor pegado está en el texto pegado ("rtx5070ti"). */
function formInText(form: string, text: string): boolean {
  const tokens = text.trim().split(" ");
  if (form.split(" ").every((t) => tokens.includes(t))) return true;
  const c = compact(form);
  return c.length >= 4 && compact(text).includes(c);
}

// Valores que el extractor rellena por defecto (no los dice el título): no sirven para contradecir la ficha.
function contradictsTitle(category: Category, field: string, value: IdentityValue, regex: Attributes): boolean {
  if (typeof value === "boolean") return false;
  const attr = identityAttributeName(field);
  const said = regex[attr];
  return said !== undefined && said !== ATTRIBUTE_DEFAULTS[category]?.[attr] && said !== value;
}

// ─── Decodificadores de MPN ──────────────────────────────────────────────────

type Decoded = Partial<Record<string, IdentityValue>>;

const DDR = (d: string) => `ddr${d}`;

const n = (s: string | undefined) => Number(s);

/** Sólo patrones validados con MPN reales (spec de RAM 2026-10-07 §2 y el O8G/O12G de ASUS). */
const DECODERS: Array<[Category, RegExp, (m: RegExpMatchArray) => Decoded]> = [
  // Kingston Fury / HyperX: KF556C36BBE16 = DDR5 5600 CL36 16 GB; KF556S40IB16 = SO-DIMM; K2-32 = kit de 2 x 32 GB.
  [
    "ram",
    /^(?:KF|HX)([45])(\d{2})([CS])(\d{2})[A-Z0-9]*?(?:K(\d))?(\d{1,3})$/,
    (m) => ({
      type: DDR(m[1] ?? ""),
      speed_mt_s: n(m[2]) * 100,
      form_factor: m[3] === "S" ? "sodimm" : "dimm",
      cas_latency: n(m[4]),
      modules: m[5] ? n(m[5]) : 1,
      capacity_gb: n(m[6]),
    }),
  ],
  // Kingston ValueRAM: KVR48U40BS816 = DDR5 4800 UDIMM CL40.
  [
    "ram",
    /^KVR(\d{2})([US])(\d{2})/,
    (m) => ({ speed_mt_s: n(m[1]) * 100, form_factor: m[2] === "S" ? "sodimm" : "dimm", cas_latency: n(m[3]) }),
  ],
  // Corsair: CMH32GX5M2X7200C34 = 32 GB DDR5 kit de 2 7200 CL34.
  [
    "ram",
    /^CM[A-Z]{1,2}(\d{1,3})GX([45])M(\d)[A-Z]?(\d{4})C(\d{2})/,
    (m) => ({
      capacity_gb: n(m[1]),
      type: DDR(m[2] ?? ""),
      modules: n(m[3]),
      speed_mt_s: n(m[4]),
      cas_latency: n(m[5]),
    }),
  ],
  // ADATA XPG: AX5U6000C3016G = DDR5 6000 CL30.
  ["ram", /^AX([45])U(\d{4})C(\d{2})/, (m) => ({ type: DDR(m[1] ?? ""), speed_mt_s: n(m[2]), cas_latency: n(m[3]) })],
  // G.Skill: F56000J3040G16G = DDR5 6000 CL30.
  ["ram", /^F([45])(\d{4})J(\d{2})/, (m) => ({ type: DDR(m[1] ?? ""), speed_mt_s: n(m[2]), cas_latency: n(m[3]) })],
  // Crucial: CT16G48C40U5 = 16 GB 4800 CL40.
  [
    "ram",
    /^CT(\d{1,3})G(\d{2})C(\d{2})/,
    (m) => ({ capacity_gb: n(m[1]), speed_mt_s: n(m[2]) * 100, cas_latency: n(m[3]) }),
  ],
  // ASUS: DUAL-RTX5050-O8G = OC 8 GB; sin la O (DUAL-RTX5050-8G) es la versión base.
  [
    "gpu",
    /^(?:DUAL|TUF|ROG|PRIME|PROART|STRIX|KO|PH|ATS)[A-Z0-9]*?(O?)(\d{1,2})G[A-Z]?$/,
    (m) => ({ oc: m[1] === "O", vram_gb: n(m[2]) }),
  ],
];

/** Lo que Haiku marque como decodificado del MPN y ningún patrón nuestro confirme, no cuenta. */
export function decodeMpn(category: Category, mpn: string | null): Decoded {
  if (!mpn) return {};
  for (const [c, re, decode] of DECODERS) {
    const m = c === category ? mpn.match(re) : null;
    if (m) return decode(m);
  }
  return {};
}
