import type { Category } from "@framerate/contracts";
import { fold } from "@framerate/kit";

export type AttributeValue = string | number | boolean;
export type Attributes = Record<string, AttributeValue>;

/**
 * Perfil de matching por categoría.
 *
 * - `keyFields`: atributos que forman la clave determinística del producto.
 *   Si falta alguno, no hay clave (null) y el matching depende de identificadores.
 * - `discriminators`: atributos que, si AMBOS lados los tienen y difieren,
 *   prueban que son productos distintos (veto duro). Ej.: 12GB vs 16GB.
 * - `keyIsUnique`: la clave completa identifica un único producto real
 *   (un "Ryzen 7 7800X3D" es uno solo). Si es false, coincidir en clave
 *   no basta para fusionar automáticamente (colores, líneas, variantes OC).
 */
export interface CategoryProfile {
  extract(title: string): Attributes;
  keyFields: readonly string[];
  discriminators: readonly string[];
  keyIsUnique: boolean;
}

/** Texto comparable: minúsculas, sin tildes, separadores → espacio (conserva `+` y `.`), con espacio en los bordes. */
export function prep(title: string): string {
  return ` ${fold(title)
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/×/g, "x")
    .replace(/[^a-z0-9+.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function firstMatch(line: readonly string[], text: string): string | undefined {
  return line.find((l) => text.includes(` ${l} `));
}

// ─── GPU ─────────────────────────────────────────────────────────────────────

const GPU_LINES = [
  "rog strix",
  "rog astral",
  "tuf",
  "prime",
  "proart",
  "dual",
  "suprim",
  "gaming x trio",
  "gaming trio",
  "gaming x slim",
  "gaming x",
  "ventus 3x",
  "ventus 2x",
  "ventus",
  "inspire",
  "shadow 3x",
  "shadow 2x",
  "shadow",
  "aorus master",
  "aorus elite",
  "aorus",
  "gaming oc",
  "windforce",
  "eagle",
  "aero",
  "twin edge",
  "trinity",
  "amp extreme",
  "amp",
  "solid",
  "jetstream",
  "gamerock",
  "infinity",
  "ex gamer",
  "nitro+",
  "nitro",
  "pulse",
  "pure",
  "hellhound",
  "red devil",
  "fighter",
  "reaper",
  "challenger",
  "steel legend",
  "phantom gaming",
  "taichi",
  "swift",
  "speedster",
  "qick",
  "merc",
  "mech",
  "xc",
  "ftw3",
  "ftw",
  "vanguard",
  "founders edition",
  // Ediciones y líneas vistas en títulos reales de tiendas chilenas (#146). Sin "gaming" a secas: es genérico y
  // "ZOTAC GAMING" es la marca, no la línea.
  "world of warcraft midnight void",
  "world of warcraft midnight light",
  "frieren",
  "mlg",
  "lightning",
  "phoenix",
  "t1",
  "ko",
  "elf",
  "zone",
  "eco",
  "lp",
] as const;

const gpu: CategoryProfile = {
  keyFields: ["chipset", "vram", "line", "oc"],
  discriminators: ["chipset", "vram", "line", "oc", "variant"],
  keyIsUnique: false,
  extract(title) {
    const t = prep(title);
    const a: Attributes = {};
    // "rt" es un error de tipeo frecuente de "rtx".
    const nv = t.match(/ (rtx?|gtx|gt) ?(\d{3,4}) ?(ti super|ti|super|s)?(?= )/);
    const amd = t.match(/ (?:rx|radeon) ?(\d{3,4}) ?(xtx|xt|gre)?(?= )/);
    const arc = t.match(/ arc ?([ab]\d{3})(?= )/);
    // MPN de Gigabyte usado como título: GV-N507T… = 5070 Ti, GV-N407S… = 4070 Super, GV-N5060… = 5060.
    const gv = t.match(/ gv ?n([2-9]\d{2})(ts|t|s|0)/);
    if (nv?.[1] && nv[2]) {
      const suffix = nv[3] === "s" ? "super" : nv[3];
      a.chipset = [nv[1] === "rt" ? "rtx" : nv[1], nv[2], suffix].filter(Boolean).join(" ");
    } else if (amd?.[1]) {
      a.chipset = ["rx", amd[1], amd[2]].filter(Boolean).join(" ");
    } else if (arc?.[1]) {
      a.chipset = `arc ${arc[1]}`;
    } else if (gv?.[1] && gv[2]) {
      const suffix = { ts: "ti super", t: "ti", s: "super", "0": "" }[gv[2]];
      a.chipset = ["rtx", `${gv[1]}0`, suffix].filter(Boolean).join(" ");
    }
    const vramText = t.match(/ (\d{1,2}) ?gb?(?= |d)/)?.[1] ?? t.match(/ o(\d{1,2})gb?(?= )/)?.[1];
    if (vramText) {
      const gb = Number(vramText);
      if (gb >= 2 && gb <= 48) a.vram = gb;
    }
    // Typos de línea y "low profile" escrito largo; sólo para buscar la línea.
    const lineText = t
      .replace(/ phatom /g, " phantom ")
      .replace(/ changeller /g, " challenger ")
      .replace(/ low profile /g, " lp ");
    const line = firstMatch(GPU_LINES, lineText);
    if (line) a.line = line;
    // "OC", "OCEd", "Overclocked" o el patrón de MPN de ASUS dentro del título ("O12G", "O8GB", "O 12G").
    a.oc = / (?:oc(?:ed)?|overclocked) /.test(t) || /o\d{1,2}gb? | o \d{1,2}gb? /.test(t);
    // Siempre presente, como `oc`: una V2, EVO o MAX es otra tarjeta aunque la tienda de la base no lo escriba.
    a.variant = t.match(/ (v ?2|evo|max|plus)(?= )/)?.[1]?.replace(" ", "") ?? "";
    return a;
  },
};

// ─── CPU ─────────────────────────────────────────────────────────────────────

const cpu: CategoryProfile = {
  keyFields: ["model"],
  discriminators: ["model", "packaging"],
  keyIsUnique: true,
  extract(title) {
    // "7800X 3D" (PC Express) es el 7800X3D.
    const t = prep(title).replace(/(\d{4}x) (3d)(?= )/g, "$1$2");
    const a: Attributes = {};
    const ryzen = t.match(/ ryzen ?(threadripper )?(\d) ?(pro )?(\d{4}[a-z0-9]{0,4})(?= )/);
    const ultra = t.match(/ ultra ?i?([3579]) ?(\d{3}[a-z]{0,2})(?= )/);
    const core = t.match(/ (?:core )?i([3579]) ?(\d{4,5}[a-z]{0,3})(?= )/);
    // Threadripper sin tier ("Threadripper 9970X"), Xeon con su serie y las gamas de entrada.
    const threadripper = t.match(/ threadripper ?(pro )?(\d{4}[a-z]{0,2})(?= )/);
    const xeon = t.match(/ xeon ?(bronze|silver|gold|platinum|w)? ?(\d{4}[a-z0-9+]{0,3})(?= )/);
    const entry = t.match(/ (celeron|pentium|athlon) ?(?:gold |processor |procesador )?([gjn]?\d{3,4}[a-z]{0,2})(?= )/);
    if (threadripper?.[2]) {
      a.model = ["threadripper", threadripper[1]?.trim(), threadripper[2]].filter(Boolean).join(" ");
    } else if (xeon?.[2]) {
      a.model = ["xeon", xeon[1], xeon[2]].filter(Boolean).join(" ");
    } else if (entry?.[1] && entry[2]) {
      a.model = `${entry[1]} ${entry[2]}`;
    } else if (ryzen?.[2] && ryzen[4]) {
      a.model = ["ryzen", ryzen[1]?.trim(), ryzen[2], ryzen[3]?.trim(), ryzen[4]].filter(Boolean).join(" ");
    } else if (ultra?.[1] && ultra[2]) {
      a.model = `core ultra ${ultra[1]} ${ultra[2]}`;
    } else if (core?.[1] && core[2]) {
      a.model = `core i${core[1]} ${core[2]}`;
    }
    return a;
  },
};

// ─── RAM ─────────────────────────────────────────────────────────────────────

// Líneas de RAM: Beast y Renegade comparten capacidad y velocidad pero son productos distintos.
const RAM_LINES = [
  "renegade pro",
  "renegade",
  "beast",
  "impact",
  "lpx",
  "dominator",
  "vengeance",
  "trident",
  "ripjaws",
  "flare",
  "lancer",
  "gammix",
  "spectrix",
  "caliber",
  "xlr8",
  "valueram",
  "ballistix",
  "predator",
  "delta",
  "vulcan",
] as const;

const ram: CategoryProfile = {
  keyFields: ["type", "capacity", "modules", "speed", "formFactor"],
  // `line` no va en la clave (muchas tiendas no la escriben), pero si ambos lados la dicen y difiere, es otro producto.
  // `casLatency`, `ecc` y `registered` sólo los trae el normalizador: vetan cuando ambos lados los anclan.
  discriminators: [
    "type",
    "capacity",
    "modules",
    "speed",
    "formFactor",
    "line",
    "rgb",
    "casLatency",
    "ecc",
    "registered",
  ],
  keyIsUnique: false,
  extract(title) {
    // "2*16GB" (Tecnomas) es un kit; "Vegeance" (Infor-Ingen) es Vengeance.
    const t = prep(title.replace(/\*/g, "x")).replace(/ (vegeance|vengance|vengence) /g, " vengeance ");
    const a: Attributes = {};
    const kit = t.match(/ (\d) ?x ?(\d{1,3}) ?(?:gb?)?(?= )/);
    const reversed = t.match(/ (\d{1,3}) ?gb? ?x ?(\d)(?= )/);
    const kitOf = t.match(/ kit (?:of |de )?(\d)(?= )/);
    if (kit?.[1] && kit[2]) {
      a.modules = Number(kit[1]);
      a.capacity = Number(kit[1]) * Number(kit[2]);
    } else if (reversed?.[1] && reversed[2] && Number(reversed[2]) > 1) {
      a.modules = Number(reversed[2]);
      a.capacity = Number(reversed[1]) * Number(reversed[2]);
    } else {
      const cap = t.match(/ (\d{1,3}) ?gb?(?=[ x])/);
      if (cap?.[1]) a.capacity = Number(cap[1]);
      a.modules = kitOf?.[1] && Number(kitOf[1]) > 1 ? Number(kitOf[1]) : 1;
    }
    const speed = Number(t.match(/[ x](\d{4,5}) ?(?:mhz|mt s|mts|m)?(?= )/)?.[1] ?? 0);
    if (speed) a.speed = speed;
    const type = t.match(/ ddr([345])/);
    if (type) a.type = `ddr${type[1]}`;
    // Sin "DDR" en el título: DDR5 parte en 4800 (JEDEC) y la DDR4 que se vende rara vez pasa de 4000.
    else if (speed >= 4800) a.type = "ddr5";
    else if (speed >= 2400 && speed <= 4000) a.type = "ddr4";
    a.formFactor = /so ?dimm|notebook|laptop/.test(t) ? "sodimm" : "dimm";
    const line = firstMatch(RAM_LINES, t);
    if (line) a.line = line;
    // Sin línea no se sabe si es RGB: muchas tiendas truncan el título o usan uno genérico.
    if (/rgb(?= )| rbg /.test(t) || line === "spectrix") a.rgb = true;
    else if (line) a.rgb = false;
    return a;
  },
};

// ─── Almacenamiento ──────────────────────────────────────────────────────────

function capacityGb(t: string): number | undefined {
  // "SATA 6Gb/s" es velocidad de interfaz, no capacidad ("/" ya es un espacio).
  const m = t.replace(/ \d+ ?gb? s(?= )| \d+ ?gbps(?= )/g, " ").match(/ (\d+(?:\.\d+)?) ?([tg])b?(?= )/);
  if (!m?.[1] || !m[2]) return undefined;
  // "8.192GB": en GB, tres decimales son el punto de miles.
  const n = Number(m[2] === "g" && /^\d{1,3}\.\d{3}$/.test(m[1]) ? m[1].replace(".", "") : m[1]);
  const gb = m[2] === "t" ? Math.round(n * 1000) : Math.round(n);
  // "1024GB" es la de 1 TB escrita en binario; 512 GB sí es otra capacidad que 500 GB.
  return gb >= 1024 && gb % 1024 === 0 ? (gb / 1024) * 1000 : gb;
}

const SSD_LINES = [
  "renegade",
  "legend",
  "gammix",
  "spectrix",
  "wave",
  "future",
  "elite",
  "viper",
  "spatium",
  "firecuda",
  "barracuda",
  "nv1",
  "nv2",
  "nv3",
] as const;

const ssd: CategoryProfile = {
  keyFields: ["capacity", "interface"],
  discriminators: ["capacity", "interface", "formFactor", "pcieGen", "series", "line"],
  keyIsUnique: false,
  extract(title) {
    const t = prep(title);
    const a: Attributes = {};
    const cap = capacityGb(t);
    if (cap) a.capacity = cap;
    if (/ nvme | pci/.test(t)) a.interface = "nvme";
    else if (/ sata3? /.test(t)) a.interface = "sata";
    const formFactor = t.match(/ 22 ?(30|42|80|110)(?= )/)?.[1];
    if (formFactor) a.formFactor = `22${formFactor}`;
    else if (/ 2\.5/.test(t)) a.formFactor = "2.5";
    const gen =
      t.match(/ (?:pcie|pci e|pci express|pcle|pci) ?(?:gen ?)?([345])(?:\.0)?(?= | ?x)/)?.[1] ??
      t.match(/ gen ?([345])(?= | ?x)/)?.[1];
    if (gen) a.pcieGen = Number(gen);
    // "Legend 800" frente a "Legend 860": el número de serie empieza con dígito y la similitud lo ignora.
    const series = t.match(/ [a-z]+ (\d{3})(?! ?(?:gb?|tb?|mb|w|rpm|mhz|x))(?= )/)?.[1];
    if (series && !/^(512|256|128|120|240|480|960)$/.test(series)) a.series = series;
    const line = firstMatch(SSD_LINES, t);
    if (line) a.line = line;
    return a;
  },
};

const hdd: CategoryProfile = {
  keyFields: ["capacity", "rpm"],
  discriminators: ["capacity", "rpm", "formFactor", "interface"],
  keyIsUnique: false,
  extract(title) {
    const t = prep(title);
    const a: Attributes = {};
    const cap = capacityGb(t);
    if (cap) a.capacity = cap;
    // "RMP" es un typo frecuente; los discos de servidor escriben 7.2K o 10K.
    const rpm = t.match(/ (\d{4,5}) ?r(?:pm|mp)/)?.[1];
    const rpmK = t.match(/ (7\.2|10)k(?: rpm)?(?= )/)?.[1];
    if (rpm) a.rpm = Number(rpm);
    else if (rpmK) a.rpm = Math.round(Number(rpmK) * 1000);
    if (/ sas /.test(t)) a.interface = "sas";
    else if (/ sata/.test(t)) a.interface = "sata";
    if (/ 2\.5/.test(t)) a.formFactor = "2.5";
    else if (/ 3\.5/.test(t)) a.formFactor = "3.5";
    return a;
  },
};

// ─── PSU ─────────────────────────────────────────────────────────────────────

const PSU_LINES = [
  "rog thor",
  "thor",
  "rog strix",
  "strix",
  "loki",
  "tuf",
  "prime",
  "pure power",
  "system power",
  "dark power",
  "straight power",
  "xilence",
  "elite",
  "mwe",
  "xg",
  "pylon",
  "kyber",
  "core reactor",
  "cybercore",
  "probe",
  "atlas",
  "focus",
  "vertex",
  "atom",
  "cuprum",
  "aura",
  "helios",
  "hydra",
  "hummer",
  "supernova",
  "toughpower",
  "smart",
  "mag",
  "meg",
  "mpg",
  "sfx",
] as const;
const EFFICIENCY_ALIASES: Record<string, string> = { bronce: "bronze", platino: "platinum", platinium: "platinum" };
// Cybenetics: ETA mide eficiencia ("Cybenetics Gold" a secas es ETA) y LAMBDA ruido. Informan, no distinguen productos.
const CYBENETICS_ETA = /(?: cybenetics(?: eta)?| eta) (diamond|titanium|platinum|gold|silver|bronze|standard)(?= )/;
const CYBENETICS_LAMBDA = /\blambda[\s:_-]*(a\+\+|a\+|a-|a|standard\+\+|standard\+|standard)(?![a-z0-9+-])/;

/** Niveles de Cybenetics del título de una fuente: ETA (eficiencia) y LAMBDA (ruido). Sólo aparece el que se lee. */
export function cyberneticsLevels(title: string): { eta?: string; lambda?: string } {
  const levels: { eta?: string; lambda?: string } = {};
  const eta = prep(title).match(CYBENETICS_ETA)?.[1];
  if (eta) levels.eta = eta;
  // "A-" pierde el guion en `prep`: el nivel de LAMBDA se lee del título plegado.
  const lambda = fold(title).match(CYBENETICS_LAMBDA)?.[1];
  if (lambda) levels.lambda = lambda;
  return levels;
}

const psu: CategoryProfile = {
  keyFields: ["wattage", "efficiency"],
  discriminators: ["wattage", "efficiency", "line", "revision", "modular"],
  keyIsUnique: false,
  extract(title) {
    const t = prep(title);
    const a: Attributes = {};
    const w = t.match(/ (\d{3,4}) ?w(?:atts?)?(?= )/);
    if (w?.[1]) {
      const watts = Number(w[1]);
      if (watts >= 200 && watts <= 2500) a.wattage = watts;
    } else {
      // Watts dentro del modelo (A750GLS, CX750, HX1500i). Múltiplo de 50 para no tomar años ni otros números.
      for (const m of t.matchAll(/ [a-z]{0,3}(\d{3,4})([a-z]{0,3})(?= )/g)) {
        // "2050rpm" o "1000ma" no son watts.
        if (/^(rpm|ma|mah|mm|hz|mhz|cfm|gb|tb|mb)$/.test(m[2] ?? "")) continue;
        const watts = Number(m[1]);
        if (watts >= 300 && watts <= 2500 && watts % 50 === 0) {
          a.wattage = watts;
          break;
        }
      }
    }
    Object.assign(a, cyberneticsLevels(title));
    // "White" suelto es el color; la certificación White sólo cuenta como "80 Plus" sin otro nivel.
    // El nivel de Cybenetics no es el de 80 Plus: se saca antes de buscarlo.
    const plus = t.replace(CYBENETICS_ETA, " ");
    const eff = plus.match(/(?: |plus|\+)(bronze|bronce|silver|gold|platinum|platino|platinium|titanium)(?=[ +])/)?.[1];
    if (eff) a.efficiency = EFFICIENCY_ALIASES[eff] ?? eff;
    else if (/ 80 ?\+? ?plus| 80 ?\+ ?white/.test(plus)) a.efficiency = "white";
    const line = firstMatch(PSU_LINES, t);
    if (line) {
      const generation = t.match(new RegExp(` ${line} (\\d{1,2})(?= )`))?.[1];
      a.line = generation ? `${line} ${generation}` : line;
    }
    const revision = t.match(/ (ii|iii|iv|v ?[2-5])(?= )/)?.[1];
    if (revision) a.revision = revision.replace(" ", "");
    return a;
  },
};

// ─── Placa madre ─────────────────────────────────────────────────────────────

// Líneas de placa: la primera de la lista que aparece en el título.
const MOBO_LINES = [
  "rog strix",
  "crosshair",
  "maximus",
  "tuf",
  "proart",
  "prime",
  "mortar",
  "tomahawk",
  "carbon",
  "edge",
  "project zero",
  "gaming plus",
  "gaming pro",
  "gaming x",
  "gaming",
  "elite",
  "master",
  "eagle",
  "ds3h",
  "d3hp",
  "d2hp",
  "s2h",
  "ud",
  "aero",
  "aorus",
  "steel legend",
  "pro rs",
  "pro4",
  "riptide",
  "lightning",
  "phantom",
  "hdv",
  "hvs",
  "taichi",
  "livemixer",
  "ayw",
  "btf",
] as const;

const motherboard: CategoryProfile = {
  keyFields: ["chipset", "formFactor", "wifi"],
  discriminators: ["chipset", "formFactor", "wifi", "model", "memory", "line", "variant"],
  keyIsUnique: false,
  extract(title) {
    const t = prep(title);
    const a: Attributes = {};
    // Sufijo de formato pegado al chipset: B650M/A620AM = mATX, X870I = ITX. Biostar agrega letras: B650MT, H610MHP.
    const chip = t.match(/ ([abhxz]\d{3})(e)?(m|am|i)?[a-z0-9]{0,3}(?=[ -])/);
    if (chip?.[1]) a.chipset = `${chip[1]}${chip[2] ?? ""}`;
    if (/ e ?atx /.test(t)) a.formFactor = "eatx";
    else if (/ (?:mini ?|m)?itx /.test(t) || chip?.[3] === "i") a.formFactor = "itx";
    else if (/ micro ?atx | m ?atx | matx /.test(t) || chip?.[3]) a.formFactor = "matx";
    else if (/ atx /.test(t)) a.formFactor = "atx";
    a.wifi = / wi ?fi| wifi| (ax\d?|ac)(?= )/.test(t);
    // El sufijo de una letra separa modelos (H610M-A, H610M-K): el guion ya es un espacio y los tokens de una letra
    // no cuentan en la similitud, así que va como atributo.
    const model = t.match(/ ([abhxz]\d{3}e?(?:m|am|i)?[a-z0-9]{0,3})(?: ([a-z]))?(?= )/);
    if (model?.[1]) a.model = model[1] + (model[2] ?? "");
    const memory = t.match(/ddr([45])(?= )|(?<= )d([45])(?= )/);
    if (memory) a.memory = `ddr${memory[1] ?? memory[2]}`;
    const line = firstMatch(MOBO_LINES, t);
    if (line) a.line = line;
    // Siempre presente: MAX, II y CSM son otra placa (BIOS o revisión nueva) aunque la tienda base no lo escriba. Sólo
    // entre los 3 tokens que siguen al modelo: "EZ PCIe Clip II", "SATA II" o "MAX 128GB" más lejos son otra cosa.
    const afterModel = model ? t.slice((model.index ?? 0) + model[0].length) : "";
    a.variant = afterModel.match(/^(?: [a-z0-9.+]+){0,2}? (max ii|ii|max|csm)(?= )/)?.[1] ?? "";
    return a;
  },
};

// ─── Categorías sin atributos estructurados (sólo identificadores y título) ──

const generic: CategoryProfile = {
  keyFields: [],
  // `model` lo trae el normalizador (#98); como clave se decide con la sombra de la fase 2.
  discriminators: ["model"],
  keyIsUnique: false,
  extract: () => ({}),
};

// ─── Color (transversal) ─────────────────────────────────────────────────────

const WHITE = / (white|blanc[oa]s?|wh|ice|snow)(?= )/;
// En coolers "Ice Force" es una línea, no un color.
const WHITE_SAID = / (white|blanc[oa]s?|wh|snow)(?= )/;
const BLACK_SAID = / (black|negr[oa]s?|bk)(?= )/;
// Colores que sólo aparecen dicho (un gabinete rosado es otro SKU que el blanco). Sin esto, "FV150 RGB Pink" y
// "FV150 RGB White" no tenían conflicto de color y nada los separaba (#98).
const OTHER_COLORS: Array<[string, RegExp]> = [
  ["pink", / (pink|ros[ao]s?)(?= )/],
  ["red", / (red|roj[ao]s?)(?= )/],
  ["blue", / (blue|azul(?:es)?)(?= )/],
  ["gray", / (gr[ae]y|gris(?:es)?)(?= )/],
  ["green", / (green|verdes?)(?= )/],
  ["purple", / (purple|morad[ao]s?|lila)(?= )/],
];
// "80 Plus White" es una certificación.
const CERTIFICATION_WHITE = / 80 ?\+? ?(?:plus )?white(?= )/g;

/**
 * - `standard`: donde la negra es la variante base que nadie escribe (GPU, fuente, RAM, placa), sin color = negra.
 * - `said`: sólo cuenta si el título lo dice, porque hay tiendas que publican la blanca sin decirlo.
 */
function withColor(profile: CategoryProfile, mode: "standard" | "said"): CategoryProfile {
  return {
    ...profile,
    discriminators: [...profile.discriminators, "color"],
    extract(title) {
      const a = profile.extract(title);
      const t = prep(title).replace(CERTIFICATION_WHITE, " ");
      const other = OTHER_COLORS.find(([, re]) => re.test(t))?.[0];
      if (other) a.color = other;
      else if (mode === "standard") a.color = WHITE.test(t) ? "white" : "black";
      else if (WHITE_SAID.test(t)) a.color = "white";
      else if (BLACK_SAID.test(t)) a.color = "black";
      return a;
    },
  };
}

/** Campos de identidad del normalizador cuyo nombre difiere del atributo de hoy; el resto se llama igual. */
const IDENTITY_ATTRIBUTE_NAMES: Record<string, string> = {
  capacity_gb: "capacity",
  vram_gb: "vram",
  speed_mt_s: "speed",
  form_factor: "formFactor",
  memory_type: "memory",
  pcie_gen: "pcieGen",
  cas_latency: "casLatency",
  radiator_mm: "radiatorMm",
  size_mm: "sizeMm",
};
export const identityAttributeName = (field: string): string => IDENTITY_ATTRIBUTE_NAMES[field] ?? field;

/**
 * Lo que el extractor rellena cuando el título no lo dice ("siempre presente": sin color es negra, sin variante es
 * la base, una RAM es un módulo DIMM). La huella desde la identidad aplica lo mismo; el anclaje no los toma como
 * evidencia del título. Los booleanos (`oc`, `wifi`, `rgb`) se tratan aparte: sólo con token.
 */
export const ATTRIBUTE_DEFAULTS: Partial<Record<Category, Attributes>> = {
  gpu: { variant: "", color: "black" },
  motherboard: { variant: "", color: "black" },
  ram: { modules: 1, formFactor: "dimm", color: "black" },
  psu: { color: "black" },
};

export const PROFILES: Record<Category, CategoryProfile> = {
  gpu: withColor(gpu, "standard"),
  cpu,
  ram: withColor(ram, "standard"),
  ssd,
  hdd,
  psu: withColor(psu, "standard"),
  motherboard: withColor(motherboard, "standard"),
  cpu_cooler: withColor(generic, "said"),
  case: withColor(generic, "said"),
  case_fan: withColor(generic, "said"),
};
