import type { Category } from "@framerate/contracts";
import { freeTextFields } from "./decide";

/**
 * Vocabulario canónico del texto libre (`freeTextFields`): Haiku escribe la misma línea distinto entre llamadas ("TUF
 * Gaming" y "TUF", "Fury Renegade" y "Renegade", "ML240L" y "MasterLiquid 240L"). Aquí se decide qué variantes son lo
 * mismo, por categoría y marca canónica; ante la duda no se juntan ("Lancer" y "Lancer Blade", "Renegade" y "Renegade
 * G5", "Gaming X" y "Gaming X Trio", "Shadow" y "Shadow 2X" son otros productos). Medido en producción el 10-10.
 */

type Rewrite = readonly [RegExp, string];

interface Vocab {
  /** Lo que se le muestra a Haiku: cómo escribe el catálogo las líneas (o modelos) de la marca. */
  canonical?: readonly string[];
  /** Sobre ` valor ` (minúsculas, con espacio en los bordes); van primero las de la categoría (`*`). */
  rewrite?: readonly Rewrite[];
  /** Valor completo, ya reescrito → canónico. */
  alias?: Readonly<Record<string, string>>;
}

const drop = (...words: string[]): Rewrite => [new RegExp(` (?:${words.join("|")})(?= )`, "g"), ""];
const swap = (from: string, to: string): Rewrite => [new RegExp(` ${from}(?= )`, "g"), ` ${to}`];

// En ASUS, Zotac, EVGA y Sapphire "Gaming" es parte del nombre de la marca o del sufijo, nunca separa productos; en MSI
// y Gigabyte sí es línea ("Gaming X", "Gaming OC").
const GAMING = drop("gaming");

const VOCABULARY: Partial<Record<Category, Record<string, Vocab>>> = {
  gpu: {
    // OC tiene campo propio.
    "*": { rewrite: [drop("oc", "geforce", "radeon"), swap("low profile", "lp")] },
    ASUS: {
      canonical: ["dual", "prime", "tuf", "rog strix", "rog astral", "proart", "phoenix", "ko", "t1"],
      rewrite: [GAMING],
      alias: { strix: "rog strix", astral: "rog astral" },
    },
    MSI: {
      canonical: [
        "ventus 2x",
        "ventus 3x",
        "ventus xs",
        "ventus 2x xs",
        "shadow 2x",
        "shadow 3x",
        "inspire 2x",
        "inspire 3x",
        "gaming",
        "gaming x",
        "gaming trio",
        "gaming x trio",
        "gaming x slim",
        "suprim",
        "suprim liquid x",
        "vanguard",
        "lightning z",
        "aero itx",
        "lp",
      ],
      // La RTX 5090 Lightning es sólo Z.
      alias: { lightning: "lightning z" },
    },
    Gigabyte: {
      canonical: ["gaming", "gaming pro", "eagle", "windforce", "aero", "aorus elite", "aorus master", "lp"],
    },
    Zotac: {
      canonical: ["twin edge", "solid", "solid sff", "amp", "amp extreme infinity", "trinity", "lp"],
      // "ZOTAC GAMING" es la marca: "Gaming Twin Edge" es la Twin Edge.
      rewrite: [GAMING],
    },
    ASRock: {
      canonical: ["challenger", "steel legend", "phantom gaming", "taichi"],
      rewrite: [[/ (?<!phantom) gaming(?= )/g, ""]],
      alias: { phantom: "phantom gaming", pg: "phantom gaming" },
    },
    EVGA: { canonical: ["xc", "xc3", "sc", "ftw3", "ftw3 ultra"], rewrite: [GAMING] },
    Sapphire: { canonical: ["pulse", "pure", "nitro+"], rewrite: [GAMING] },
    PowerColor: { canonical: ["hellhound", "reaper", "red devil", "fighter"] },
  },
  ssd: {
    "*": { rewrite: [drop("series", "ssd")] },
    Kingston: {
      canonical: ["a400", "nv1", "nv2", "nv3", "kc600", "kc3000", "renegade", "renegade g5", "dc600m", "q500"],
      // "Fury Renegade" es la Renegade; "SNV3S" y "SKC600" son el prefijo del MPN.
      rewrite: [drop("ssdnow", "data center", "enterprise", "fury")],
      alias: {
        snv3: "nv3",
        snv2: "nv2",
        skc600: "kc600",
        skc3000: "kc3000",
        sa400: "a400",
        sa2000: "a2000",
        sq500: "q500",
        suv500: "uv500",
        sedc600m: "dc600m",
      },
    },
    ADATA: {
      canonical: [
        "su650",
        "legend 700",
        "legend 700 gold",
        "legend 710",
        "legend 800",
        "legend 860",
        "legend 960",
        "legend 960 max",
        "gammix s70",
        "gammix s70 blade",
      ],
      // Las SU de ADATA son todas "Ultimate"; S70B es el código de la S70 Blade.
      rewrite: [drop("ultimate", "xpg", "adata")],
      alias: { "gammix s70b blade": "gammix s70 blade" },
    },
    "Western Digital": {
      canonical: [
        "green",
        "blue",
        "black",
        "green sn350",
        "green sn3000",
        "black sn770",
        "black sn7100",
        "black sn850x",
      ],
      rewrite: [drop("wd")],
    },
    Crucial: { canonical: ["bx500", "mx500", "p3", "p3 plus", "p310", "t500", "t700", "e100"] },
    Kingspec: { canonical: ["ne", "p3"] },
    Lenovo: { rewrite: [drop("thinksystem")] },
  },
  ram: {
    Kingston: {
      canonical: ["beast", "renegade", "renegade pro", "impact", "valueram", "predator"],
      alias: { "value ram": "valueram" },
    },
    ADATA: {
      canonical: [
        "lancer",
        "lancer blade",
        "gammix d35",
        "gammix d10",
        "gammix d30",
        "gammix d45",
        "spectrix d35g",
        "spectrix d41",
        "spectrix d50",
        "spectrix d60g",
        "spectrix d80",
        "premier",
      ],
      // XPG: las D sin G son Gammix, sin RGB; las D con G y las D41/D50/D80 son Spectrix. "Spectrix D35" no existe y
      // queda como está: no se sabe si es la D35 o la D35G.
      rewrite: [drop("xpg", "adata")],
      alias: {
        d10: "gammix d10",
        d20: "gammix d20",
        d30: "gammix d30",
        d35: "gammix d35",
        d45: "gammix d45",
        d35g: "spectrix d35g",
        d41: "spectrix d41",
        d45g: "spectrix d45g",
        d50: "spectrix d50",
        d60g: "spectrix d60g",
        d80: "spectrix d80",
      },
    },
    Corsair: {
      canonical: [
        "vengeance",
        "vengeance lpx",
        "vengeance pro",
        "vengeance pro sl",
        "vengeance rs",
        "vengeance rt",
        "dominator platinum",
        "dominator titanium",
        "value select",
      ],
      alias: { lpx: "vengeance lpx" },
    },
    Crucial: { canonical: ["pro", "ballistix", "basics"], rewrite: [drop("crucial")] },
    TeamGroup: {
      canonical: ["delta", "vulcan", "elite", "elite plus"],
      rewrite: [drop("t", "force", "tforce"), swap("elite\\+", "elite plus")],
    },
    Lenovo: { rewrite: [drop("thinksystem")] },
  },
  psu: {
    // La eficiencia tiene campo propio: "Elite Gold" es la Elite y "MWE Bronze" la MWE.
    "*": { rewrite: [drop("series", "80 ?plus", "gold", "bronze", "platinum", "titanium")] },
    ASUS: {
      canonical: ["prime", "tuf", "rog strix", "rog thor", "rog loki"],
      rewrite: [GAMING],
      alias: { thor: "rog thor", strix: "rog strix", loki: "rog loki" },
    },
    ADATA: {
      canonical: ["core reactor", "cybercore", "kyber", "pylon", "probe", "fusion"],
      rewrite: [drop("xpg")],
      alias: { corereactor: "core reactor" },
    },
    Corsair: { canonical: ["cx", "cv", "rm", "rme", "rmx", "rmx shift", "hx", "hxi", "sf"] },
    "Cooler Master": { canonical: ["elite", "elite nex", "mwe", "xg", "v", "g", "gx"] },
    MSI: { canonical: ["mag", "mpg", "meg"] },
    "be quiet!": {
      canonical: [
        "system power 11",
        "pure power 12",
        "pure power 13",
        "straight power 12",
        "dark power 13",
        "dark power pro",
      ],
    },
    Gigabyte: { canonical: ["ud", "p", "aorus elite"], alias: { "ultra durable": "ud" } },
    Cougar: { canonical: ["atlas", "gex", "gle", "gr", "vte", "xtc"] },
    GameMax: { canonical: ["vp", "gp", "gx", "gx pro", "gz", "ge"] },
    NZXT: { canonical: ["c"] },
    Seasonic: { canonical: ["focus gx", "focus gm", "core gx", "g12 gc", "g12 gm", "vertex", "prime"] },
  },
  motherboard: {
    ASUS: {
      canonical: ["prime", "tuf", "rog strix", "rog crosshair", "rog maximus", "proart"],
      rewrite: [GAMING],
      alias: { strix: "rog strix", crosshair: "rog crosshair", maximus: "rog maximus" },
    },
    MSI: {
      canonical: ["pro", "mag", "mag tomahawk", "mag mortar", "mpg", "meg", "gaming plus"],
      alias: { tomahawk: "mag tomahawk", mortar: "mag mortar" },
    },
    Gigabyte: {
      canonical: ["aorus elite", "aorus pro", "aorus master", "eagle", "gaming x", "ud", "ds3h", "aero"],
      alias: { elite: "aorus elite" },
    },
    // ASRock abrevia Phantom Gaming como PG ("B650M PG Riptide").
    ASRock: {
      canonical: ["pro", "pro rs", "pro4", "steel legend", "pg", "pg riptide", "pg lightning", "taichi", "hdv"],
      rewrite: [swap("phantom gaming", "pg")],
      alias: { riptide: "pg riptide", lightning: "pg lightning" },
    },
  },
  cpu_cooler: {
    "*": { rewrite: [drop("series"), [/ (\d{3}) ?mm(?= )/g, " $1"]] },
    // Cooler Master abrevia MasterLiquid como ML ("ML240L Core", "ML Core Nex") y a veces lo omite ("240L Core").
    "Cooler Master": {
      canonical: [
        "hyper 212",
        "hyper 212 halo",
        "hyper 212 3dhp",
        "hyper 212 spectrum v3",
        "hyper 612 apex",
        "masterliquid 240l core",
        "masterliquid 360l core",
        "masterliquid core nex 240",
        "masterliquid core nex 360",
        "masterliquid 240 atmos",
        "masterliquid 240 illusion",
      ],
      rewrite: [
        [/(?: masterliquid)? ml(?=\d| )/g, " masterliquid "],
        [/^ (?=core |\d{3}l? )/, " masterliquid "],
      ],
    },
    // MAG o MPG lo dice la letra del modelo (A13 es MAG, D360 es MPG); "A13 240" es la CoreLiquid A13 240.
    MSI: {
      canonical: [
        "coreliquid a13 240",
        "coreliquid a13 360",
        "coreliquid a15 240",
        "coreliquid a15 360",
        "coreliquid e240",
        "coreliquid e360",
        "coreliquid i240",
        "coreliquid m240",
        "coreliquid p13 360",
        "corefrozr aa13",
      ],
      rewrite: [drop("mag", "mpg", "meg"), [/^ (?=[a-z]\d{2,3} )/, " coreliquid "]],
    },
    ASUS: {
      canonical: ["tuf lc iii 360", "rog strix lc iii 360", "rog ryujin iii 360", "rog ryuo iv 360", "prime lc 360"],
      rewrite: [GAMING],
    },
    Corsair: {
      canonical: ["h100i elite", "h150i elite", "link titan 240 rx", "link titan 360 rx", "nautilus 240 rs"],
      // "iCUE" es el software; "iCUE LINK" sí es otra familia y queda como "link".
      rewrite: [drop("icue")],
    },
    Gigabyte: {
      canonical: ["waterforce 240", "waterforce 360", "waterforce x 360", "gaming 360", "eagle 360"],
      rewrite: [drop("aorus")],
    },
    Cougar: { canonical: ["forza 50", "forza 85", "forza 85 essential", "poseidon elite 240", "poseidon elite 360"] },
    NOX: { rewrite: [drop("hummer")] },
  },
  case: {
    "*": { rewrite: [drop("series")] },
    ASUS: {
      canonical: ["a21", "a31 plus", "tuf gt302", "tuf gt502", "prime ap201", "proart pa401"],
      rewrite: [GAMING],
    },
    MSI: {
      canonical: ["forge 100r", "forge 120a airflow", "pano 100r pz", "pano m100r pz", "gungnir 110r", "sekira 500g"],
      rewrite: [drop("mag", "mpg", "meg")],
    },
    Corsair: {
      canonical: ["3000d airflow", "4000d airflow", "5000x", "6500x", "frame 4000d"],
      rewrite: [drop("icue")],
    },
    "Cooler Master": {
      canonical: ["mb520", "mb311l", "q300l", "nr200p", "td500 mesh", "elite 302", "elite 490", "cmp520"],
      rewrite: [drop("masterbox"), [/^ (?=\d{3} )/, " mb"], [/ cmp (\d)/g, " cmp$1"]],
    },
    Gigabyte: { canonical: ["c102 glass", "c301 glass", "c500 panoramic stealth"], rewrite: [drop("aorus")] },
    "be quiet!": {
      canonical: ["pure base 500dx", "pure base 501", "light base 600 lx", "light base 900 fx"],
      rewrite: [[/ (\d{3}) (dx|fx|lx)(?= )/g, " $1$2"]],
    },
    "Formula V Line": { canonical: ["z1cm plus ar", "z6m floe", "z8"], rewrite: [drop("crystal")] },
    NOX: { rewrite: [drop("hummer")] },
  },
  case_fan: {
    "*": { rewrite: [drop("series")] },
    "Cooler Master": {
      canonical: ["mf120 halo", "mf120 lite", "mf120 prismatic", "mobius 120p"],
      rewrite: [drop("masterfan")],
    },
    Corsair: { rewrite: [drop("icue")] },
    Cougar: { rewrite: [swap("forward blade", "fb"), swap("reverse blade", "rb")] },
    GameMax: { rewrite: [swap("air force", "airforce")] },
    NOX: { rewrite: [drop("hummer"), swap("easy link", "easylink")] },
  },
};

const vocab = (category: string, brand: string | null) => {
  const byBrand = VOCABULARY[category as Category];
  return { all: byBrand?.["*"], brand: brand ? byBrand?.[brand] : undefined };
};

/** La forma canónica de un valor de texto libre ya normalizado (minúsculas, separadores a espacio). */
export function canonicalText(category: string, brand: string | null, field: string, value: string): string {
  if (!freeTextFields(category).includes(field)) return value;
  const v = vocab(category, brand);
  let text = ` ${value} `;
  for (const [re, to] of [...(v.all?.rewrite ?? []), ...(v.brand?.rewrite ?? [])]) text = text.replace(re, to);
  // "MasterLiquid ML240" deja "masterliquid" dos veces.
  const words = [...new Set(text.split(" ").filter(Boolean))].join(" ");
  // Si las reglas lo vacían ("Gaming" a secas en Zotac), no se sabe la línea: queda lo que dijo.
  if (!words) return value;
  return v.brand?.alias?.[words] ?? words;
}

/** Lo que se le muestra a Haiku para la marca y categoría de la oferta. */
export const canonicalValues = (category: string, brand: string | null): readonly string[] =>
  vocab(category, brand).brand?.canonical ?? [];

/** Formas completas que llevan a `canonical` ("lpx" → "vengeance lpx"): sirven para anclarlo en el título. */
export const aliasesOf = (category: string, brand: string | null, canonical: string): string[] =>
  Object.entries(vocab(category, brand).brand?.alias ?? {})
    .filter(([, to]) => to === canonical)
    .map(([from]) => from);
