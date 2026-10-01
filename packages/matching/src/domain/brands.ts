import { fold } from "@framerate/kit";

/**
 * Diccionario de marcas: nombre canónico → alias (en forma `fold`).
 * Se prueban primero los alias más largos, para que "western digital"
 * gane sobre "wd" y "cooler master" no se confunda con otras.
 */
const BRANDS: Record<string, string[]> = {
  ASUS: ["asus", "rog", "tuf gaming"],
  MSI: ["msi"],
  Gigabyte: ["gigabyte", "aorus"],
  ASRock: ["asrock"],
  Zotac: ["zotac"],
  PNY: ["pny"],
  Galax: ["galax"],
  Palit: ["palit"],
  Inno3D: ["inno3d"],
  Gainward: ["gainward"],
  EVGA: ["evga"],
  Sapphire: ["sapphire"],
  PowerColor: ["powercolor"],
  XFX: ["xfx"],
  Intel: ["intel"],
  AMD: ["amd"],
  NVIDIA: ["nvidia"],
  Kingston: ["kingston", "hyperx"],
  Corsair: ["corsair"],
  "G.Skill": ["g.skill", "gskill", "g skill"],
  Crucial: ["crucial"],
  ADATA: ["adata", "xpg", "adata xpg"],
  Kingspec: ["kingspec"],
  TWSC: ["twsc"],
  Netac: ["netac"],
  Oreton: ["oreton"],
  Norvm: ["norvm"],
  TeamGroup: ["teamgroup", "team group", "t-force", "tforce"],
  Patriot: ["patriot"],
  Samsung: ["samsung"],
  "Western Digital": ["western digital", "wester digital", "wd"],
  Seagate: ["seagate"],
  Toshiba: ["toshiba"],
  Lexar: ["lexar"],
  Hikvision: ["hikvision", "hiksemi"],
  Seasonic: ["seasonic"],
  Thermaltake: ["thermaltake"],
  "Cooler Master": ["cooler master", "coolermaster"],
  "be quiet!": ["be quiet"],
  Cougar: ["cougar"],
  Deepcool: ["deepcool"],
  Arctic: ["arctic"],
  Noctua: ["noctua"],
  NZXT: ["nzxt"],
  "Lian Li": ["lian li", "lian-li"],
  "Fractal Design": ["fractal design", "fractal"],
  Antec: ["antec"],
  Montech: ["montech"],
  Gamdias: ["gamdias"],
  GameMax: ["gamemax"],
  Redragon: ["redragon"],
  Fantech: ["fantech"],
  "Formula V Line": ["formula v line", "formula v", "formula"],
  EsGaming: ["esgaming"],
  Xtech: ["xtech"],
  Tryx: ["tryx"],
  Biostar: ["biostar"],
  AZZA: ["azza"],
  Raidmax: ["raidmax"],
  Einarex: ["einarex"],
  Checkpoint: ["checkpoint"],
  Riotoro: ["riotoro", "rio toro"],
  NOX: ["nox"],
};

/** Texto comparable: sin tildes, minúsculas, separadores unificados a un espacio. */
const brandText = (s: string) =>
  fold(s)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const ALIASES: Array<[alias: string, brand: string]> = Object.entries(BRANDS)
  .flatMap(([brand, aliases]) => aliases.map((a) => [brandText(a), brand] as [string, string]))
  .sort((a, b) => b[0].length - a[0].length);

const ALIAS_TO_BRAND = new Map(ALIASES);
for (const brand of Object.keys(BRANDS)) ALIAS_TO_BRAND.set(brandText(brand), brand);

/** Marca canónica a partir de un valor explícito (atributo de la tienda). */
export function canonicalBrand(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return ALIAS_TO_BRAND.get(brandText(raw)) ?? null;
}

/**
 * Detecta la marca en un título. Busca palabras completas para que "amd" no
 * aparezca dentro de otra palabra. NVIDIA/AMD/Intel como chip (ej. "Radeon",
 * "GeForce") NO cuentan como marca de una GPU de ensamblador: por eso la marca
 * explícita de la tienda tiene prioridad y los ensambladores se prueban antes.
 */
export function detectBrand(title: string): string | null {
  const text = ` ${brandText(title)} `;
  const chipMakers = new Set(["AMD", "NVIDIA", "Intel"]);
  let chipMaker: string | null = null;
  for (const [alias, brand] of ALIASES) {
    if (!text.includes(` ${alias} `)) continue;
    if (chipMakers.has(brand)) {
      chipMaker ??= brand;
      continue;
    }
    return brand;
  }
  return chipMaker;
}
