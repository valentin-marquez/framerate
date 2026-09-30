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

/** Texto comparable: minúsculas, sin tildes, separadores → espacio (conserva `+` y `.`). */
function prep(title: string): string {
  return ` ${fold(title)
    .replace(/,/g, ".")
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
  "ftw",
  "founders edition",
] as const;

const gpu: CategoryProfile = {
  keyFields: ["chipset", "vram", "line", "oc"],
  discriminators: ["chipset", "vram", "line", "oc"],
  keyIsUnique: false,
  extract(title) {
    const t = prep(title);
    const a: Attributes = {};
    const nv = t.match(/ (rtx|gtx|gt) ?(\d{3,4}) ?(ti super|ti|super|s)?(?= )/);
    const amd = t.match(/ rx ?(\d{4}) ?(xtx|xt|gre)?(?= )/);
    const arc = t.match(/ arc ?([ab]\d{3})(?= )/);
    if (nv?.[1] && nv[2]) {
      const suffix = nv[3] === "s" ? "super" : nv[3];
      a.chipset = [nv[1], nv[2], suffix].filter(Boolean).join(" ");
    } else if (amd?.[1]) {
      a.chipset = ["rx", amd[1], amd[2]].filter(Boolean).join(" ");
    } else if (arc?.[1]) {
      a.chipset = `arc ${arc[1]}`;
    }
    const vram = t.match(/ (\d{1,2}) ?gb?(?= |ddr|gddr)/);
    if (vram?.[1]) {
      const gb = Number(vram[1]);
      if (gb >= 2 && gb <= 48) a.vram = gb;
    }
    const line = firstMatch(GPU_LINES, t);
    if (line) a.line = line;
    // "OC" o el patrón de MPN de ASUS "O12G" dentro del título.
    a.oc = / oc /.test(t) || /o\d{1,2}g /.test(t);
    return a;
  },
};

// ─── CPU ─────────────────────────────────────────────────────────────────────

const cpu: CategoryProfile = {
  keyFields: ["model"],
  discriminators: ["model"],
  keyIsUnique: true,
  extract(title) {
    const t = prep(title);
    const a: Attributes = {};
    const ryzen = t.match(/ ryzen ?(threadripper )?(\d) ?(pro )?(\d{4}[a-z0-9]{0,4})(?= )/);
    const ultra = t.match(/ ultra ?([3579]) ?(\d{3}[a-z]{0,2})(?= )/);
    const core = t.match(/ (?:core )?i([3579]) ?(\d{4,5}[a-z]{0,3})(?= )/);
    if (ryzen?.[2] && ryzen[4]) {
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

const ram: CategoryProfile = {
  keyFields: ["type", "capacity", "modules", "speed", "formFactor"],
  discriminators: ["type", "capacity", "modules", "speed", "formFactor"],
  keyIsUnique: false,
  extract(title) {
    const t = prep(title);
    const a: Attributes = {};
    const type = t.match(/ ddr([345])/);
    if (type) a.type = `ddr${type[1]}`;
    const kit = t.match(/ (\d) ?x ?(\d{1,3}) ?gb/);
    if (kit?.[1] && kit[2]) {
      a.modules = Number(kit[1]);
      a.capacity = Number(kit[1]) * Number(kit[2]);
    } else {
      const cap = t.match(/ (\d{1,3}) ?gb/);
      if (cap?.[1]) a.capacity = Number(cap[1]);
      a.modules = 1;
    }
    const speed = t.match(/ (\d{4,5}) ?(?:mhz|mt s|mts)(?= )/) ?? t.match(/ ddr[45] ?(\d{4,5})(?= )/);
    if (speed?.[1]) a.speed = Number(speed[1]);
    a.formFactor = /so ?dimm|notebook|laptop/.test(t) ? "sodimm" : "dimm";
    return a;
  },
};

// ─── Almacenamiento ──────────────────────────────────────────────────────────

function capacityGb(t: string): number | undefined {
  const m = t.match(/ (\d+(?:\.\d+)?) ?(tb|gb)(?= )/);
  if (!m?.[1] || !m[2]) return undefined;
  const n = Number(m[1]);
  return m[2] === "tb" ? Math.round(n * 1000) : Math.round(n);
}

const ssd: CategoryProfile = {
  keyFields: ["capacity", "interface"],
  discriminators: ["capacity", "interface"],
  keyIsUnique: false,
  extract(title) {
    const t = prep(title);
    const a: Attributes = {};
    const cap = capacityGb(t);
    if (cap) a.capacity = cap;
    if (/ nvme | pcie/.test(t)) a.interface = "nvme";
    else if (/ sata /.test(t)) a.interface = "sata";
    return a;
  },
};

const hdd: CategoryProfile = {
  keyFields: ["capacity", "rpm"],
  discriminators: ["capacity", "rpm", "formFactor"],
  keyIsUnique: false,
  extract(title) {
    const t = prep(title);
    const a: Attributes = {};
    const cap = capacityGb(t);
    if (cap) a.capacity = cap;
    const rpm = t.match(/ (\d{4,5}) ?rpm/);
    if (rpm?.[1]) a.rpm = Number(rpm[1]);
    if (/ 2\.5/.test(t)) a.formFactor = "2.5";
    else if (/ 3\.5/.test(t)) a.formFactor = "3.5";
    return a;
  },
};

// ─── PSU ─────────────────────────────────────────────────────────────────────

const psu: CategoryProfile = {
  keyFields: ["wattage", "efficiency"],
  discriminators: ["wattage", "efficiency"],
  keyIsUnique: false,
  extract(title) {
    const t = prep(title);
    const a: Attributes = {};
    const w = t.match(/ (\d{3,4}) ?w(?:atts?)?(?= )/);
    if (w?.[1]) {
      const watts = Number(w[1]);
      if (watts >= 200 && watts <= 2500) a.wattage = watts;
    }
    const eff = t.match(/ (white|bronze|silver|gold|platinum|titanium)(?= )/);
    if (eff?.[1]) a.efficiency = eff[1];
    else if (/ 80 ?\+? ?plus(?! (?:white|bronze|silver|gold|platinum|titanium))/.test(t)) a.efficiency = "white";
    return a;
  },
};

// ─── Placa madre ─────────────────────────────────────────────────────────────

const motherboard: CategoryProfile = {
  keyFields: ["chipset", "formFactor", "wifi"],
  discriminators: ["chipset", "formFactor", "wifi"],
  keyIsUnique: false,
  extract(title) {
    const t = prep(title);
    const a: Attributes = {};
    const chip = t.match(/ ([abhxz]\d{3})(e)?(m)?(?=[ -])/);
    if (chip?.[1]) a.chipset = `${chip[1]}${chip[2] ?? ""}`;
    if (/ e ?atx /.test(t)) a.formFactor = "eatx";
    else if (/ mini ?itx | itx /.test(t)) a.formFactor = "itx";
    else if (/ micro ?atx | m ?atx | matx /.test(t) || chip?.[3]) a.formFactor = "matx";
    else if (/ atx /.test(t)) a.formFactor = "atx";
    a.wifi = / wi ?fi| wifi/.test(t);
    return a;
  },
};

// ─── Categorías sin atributos estructurados (sólo identificadores y título) ──

const generic: CategoryProfile = {
  keyFields: [],
  discriminators: [],
  keyIsUnique: false,
  extract: () => ({}),
};

export const PROFILES: Record<Category, CategoryProfile> = {
  gpu,
  cpu,
  ram,
  ssd,
  hdd,
  psu,
  motherboard,
  cpu_cooler: generic,
  case: generic,
  case_fan: generic,
};
