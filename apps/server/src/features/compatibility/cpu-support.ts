/**
 * Qué generaciones de procesador soporta cada chipset (#188, primera entrega): de fábrica, con BIOS actualizada, o no.
 * Es por chipset y no por placa: la lista exacta con la BIOS mínima de cada modelo queda para la referencia por placa.
 * "bios" cubre el caso típico: el procesador salió después que el chipset y una placa de la primera tanda puede no dar
 * imagen sin actualizar. Fuentes: tablas de soporte de AMD (AM4 y AM5) e Intel (series 300 a 800), octubre de 2026.
 */

/** Familia de procesador: "r5000", "r5000g" (APU AM4), "r8000g", "i12" (Core de 12.ª gen), "u200" (Core Ultra 200S). */
export type CpuFamily = string;

const AM4_300 = { native: ["r1000", "r2000"], bios: ["r3000", "r3000g", "r4000g", "r5000", "r5000g"] };
const AM4_400 = { native: ["r1000", "r2000"], bios: ["r3000", "r3000g", "r4000g", "r5000", "r5000g"] };
const AM4_500 = { native: ["r3000"], bios: ["r4000g", "r5000", "r5000g"] };
const AM5_600 = { native: ["r7000"], bios: ["r8000g", "r9000"] };
const AM5_800 = { native: ["r7000", "r8000g", "r9000"], bios: [] };
const LGA1700_600 = { native: ["i12"], bios: ["i13", "i14"] };
const LGA1700_700 = { native: ["i12", "i13"], bios: ["i14"] };
const LGA1851_800 = { native: ["u200"], bios: [] };

const CHIPSETS: Record<string, { native: CpuFamily[]; bios: CpuFamily[] }> = {
  a320: AM4_300,
  b350: AM4_300,
  x370: AM4_300,
  b450: AM4_400,
  x470: AM4_400,
  a520: AM4_500,
  b550: AM4_500,
  x570: { native: ["r2000", "r3000", "r3000g"], bios: ["r4000g", "r5000", "r5000g"] },
  a620: AM5_600,
  b650: AM5_600,
  b650e: AM5_600,
  x670: AM5_600,
  x670e: AM5_600,
  b840: AM5_800,
  b850: AM5_800,
  b850e: AM5_800,
  x870: AM5_800,
  x870e: AM5_800,
  h310: { native: ["i8"], bios: ["i9"] },
  b360: { native: ["i8"], bios: ["i9"] },
  h370: { native: ["i8"], bios: ["i9"] },
  z370: { native: ["i8"], bios: ["i9"] },
  z390: { native: ["i8", "i9"], bios: [] },
  h410: { native: ["i10"], bios: [] },
  b460: { native: ["i10"], bios: [] },
  h470: { native: ["i10"], bios: ["i11"] },
  z490: { native: ["i10"], bios: ["i11"] },
  h510: { native: ["i10", "i11"], bios: [] },
  b560: { native: ["i10", "i11"], bios: [] },
  h570: { native: ["i10", "i11"], bios: [] },
  z590: { native: ["i10", "i11"], bios: [] },
  h610: LGA1700_600,
  b660: LGA1700_600,
  h670: LGA1700_600,
  z690: LGA1700_600,
  b760: LGA1700_700,
  h770: LGA1700_700,
  z790: LGA1700_700,
  h810: LGA1851_800,
  b860: LGA1851_800,
  z890: LGA1851_800,
};

/** "B650E", "AMD B650", "Intel Z790" → "b650e", "z790"; null si no es un chipset de escritorio conocido. */
export function chipsetKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.toLowerCase().match(/\b([abhxz]\d{3}e?)\b/);
  return m?.[1] && m[1] in CHIPSETS ? m[1] : null;
}

/**
 * Familia a partir de `identity.model` ("ryzen 7 7800x3d", "ryzen 5 5600g", "core i5 12400f", "core ultra 7 265k",
 * "celeron g6900"); null para Threadripper, Xeon y lo que no se reconoce.
 */
export function cpuFamily(model: unknown): CpuFamily | null {
  if (typeof model !== "string") return null;
  const m = model.toLowerCase();
  if (/threadripper|xeon|epyc/.test(m)) return null;
  const amd = m.match(/^(?:ryzen|athlon)\b.*?\b(\d)(\d{3})([a-z]*)/);
  if (amd) {
    const series = Number(amd[1]) * 1000;
    // Los APU de AM4 (G, GE, GT) tienen su propia lista de soporte; en AM5 sólo la serie 8000 es "G".
    const apu = (amd[3] ?? "").startsWith("g") && [3000, 4000, 5000, 8000].includes(series);
    return `r${series}${apu ? "g" : ""}`;
  }
  const ultra = m.match(/\bcore ultra \d\s*(\d{3})/)?.[1];
  if (ultra) return ultra.startsWith("2") ? "u200" : null;
  const core = m.match(/\bcore i\d[- ](\d{4,5})/)?.[1];
  if (core) return `i${core.slice(0, core.length === 5 ? 2 : 1)}`;
  const g = m.match(/\b(?:celeron|pentium)(?: gold)? g(\d{4})/)?.[1];
  if (g) {
    const n = Number(g);
    return n >= 6900 ? "i12" : n >= 5900 ? "i10" : n >= 4900 ? "i9" : n >= 3900 ? "i8" : null;
  }
  return null;
}

/** "r5000g" → "Ryzen 5000 G", "i13" → "Core de 13.ª generación", "u200" → "Core Ultra serie 200". */
export function familyLabel(family: CpuFamily): string {
  if (family === "u200") return "Core Ultra serie 200";
  if (family.startsWith("i")) return `Core de ${family.slice(1)}.ª generación`;
  return `Ryzen ${family.slice(1, 5)}${family.endsWith("g") ? " G" : ""}`;
}

export function cpuSupport(chipset: string, family: CpuFamily): "native" | "bios" | "unsupported" {
  const row = CHIPSETS[chipset];
  if (!row) return "unsupported";
  return row.native.includes(family) ? "native" : row.bios.includes(family) ? "bios" : "unsupported";
}
