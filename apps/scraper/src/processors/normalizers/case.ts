/**
 * Normalizador de Títulos de Gabinetes/Cases
 *
 * Normaliza los títulos de gabinetes a un formato consistente.
 * Formato: "Marca Modelo [FormFactor] [Características] [Color]"
 * Ejemplo: "Corsair 4000D Airflow Mid Tower TG Mesh Negro"
 *
 * ADVERTENCIA: Este código es horrible y necesita refactorización urgente.
 * TODO: Mejorar esta atrocidad de normalización cuando tengamos tiempo (nunca).
 * talvez con ML/AI o algo similar.
 */

import { cleanHtmlEntities } from "./utils";

/** Mapeo de marcas de gabinetes */

const CASE_BRANDS: Record<string, string> = {
  ANTEC: "Antec",
  CORSAIR: "Corsair",
  NZXT: "NZXT",
  "LIAN LI": "Lian Li",
  LIANLI: "Lian Li",
  "FRACTAL DESIGN": "Fractal Design",
  FRACTAL: "Fractal Design",
  "COOLER MASTER": "Cooler Master",
  COOLERMASTER: "Cooler Master",
  PHANTEKS: "Phanteks",
  THERMALTAKE: "Thermaltake",
  GAMEMAX: "Gamemax",
  DEEPCOOL: "DeepCool",
  "BE QUIET!": "Be quiet!",
  "BE QUIET": "Be quiet!",
  COUGAR: "Cougar",
  ASUS: "ASUS",
  GIGABYTE: "Gigabyte",
  MSI: "MSI",
  AEROCOOL: "Aerocool",
  KOLINK: "Kolink",
  ADATA: "ADATA",
  XPG: "XPG",
  CLIO: "Clio",
  APNX: "APNX",
  ASROCK: "ASRock",
  SILVERSTONE: "SilverStone",
  MONTECH: "Montech",
  XYZ: "XYZ",
};

const FORM_FACTORS: Record<string, string> = {
  "FULL TOWER": "Full Tower",
  "FULL-TOWER": "Full Tower",
  "MID TOWER": "Mid Tower",
  "MID-TOWER": "Mid Tower",
  MIDTOWER: "Mid Tower",
  "MINI TOWER": "Mini Tower",
  "MINI-TOWER": "Mini Tower",
  MINITOWER: "Mini Tower",
  "MICRO ATX": "Micro ATX",
  "MICRO-ATX": "Micro ATX",
  MATX: "Micro ATX",
  "MINI ITX": "Mini ITX",
  "MINI-ITX": "Mini ITX",
  SFF: "SFF",
  HTPC: "HTPC",
  SLIM: "Slim",
  CUBE: "Cube",
};

const COLORS: Record<string, string> = {
  NEGRO: "Negro",
  BLACK: "Negro",
  BK: "Negro",
  BLANCO: "Blanco",
  WHITE: "Blanco",
  WH: "Blanco",
  WT: "Blanco",
  GRIS: "Gris",
  GRAY: "Gris",
  GREY: "Gris",
  ROJO: "Rojo",
  RED: "Rojo",
  AZUL: "Azul",
  BLUE: "Azul",
  VERDE: "Verde",
  GREEN: "Verde",
  ROSA: "Rosa",
  PINK: "Rosa",
};

// ============================================================================
// Extraction Helpers
// ============================================================================

function extractBrand(title: string, manufacturer?: string): string | null {
  const titleUpper = title.toUpperCase();

  // Priority check for XPG (often comes with ADATA)
  if (titleUpper.includes("XPG")) {
    return "XPG";
  }

  // Try to find brand in title
  for (const [key, value] of Object.entries(CASE_BRANDS)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escapedKey}\\b`, "i");
    if (regex.test(title)) {
      return value;
    }
  }

  // Fallback to manufacturer
  if (manufacturer) {
    const manuUpper = manufacturer.toUpperCase();
    if (CASE_BRANDS[manuUpper]) {
      return CASE_BRANDS[manuUpper];
    }
    if (manufacturer.length <= 4) {
      return manufacturer.toUpperCase();
    }
    return manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1).toLowerCase();
  }

  return null;
}

function extractFormFactor(title: string): string | null {
  const titleUpper = title.toUpperCase();

  // FIRST: Check for explicit form factors (most specific)
  // Must check BEFORE compatibility patterns
  if (titleUpper.includes("FULL TOWER") || titleUpper.includes("FULL-TOWER")) {
    return "Full Tower";
  }
  if (
    titleUpper.includes("MID TOWER") ||
    titleUpper.includes("MID-TOWER") ||
    titleUpper.includes("MIDTOWER")
  ) {
    return "Mid Tower";
  }
  if (
    titleUpper.includes("MINI TOWER") ||
    titleUpper.includes("MINI-TOWER") ||
    titleUpper.includes("MINITOWER")
  ) {
    return "Mini Tower";
  }

  // SECOND: Check for compatibility lists like "ATX, MICRO-ATX, MINI-ITX"
  // This indicates a case supporting multiple form factors - use the largest (ATX = Mid Tower)
  const hasAtxCompatibility =
    /\bATX\s*[,/]\s*(?:MICRO|M-?ATX|MINI)/i.test(title) || /\bATX\b.*\bMICRO-?ATX\b/i.test(title);
  if (hasAtxCompatibility) {
    return "Mid Tower";
  }

  // THIRD: Check for standalone form factors
  for (const [key, value] of Object.entries(FORM_FACTORS)) {
    // Skip tower types already handled above
    if (key.includes("TOWER")) continue;
    if (titleUpper.includes(key)) {
      return value;
    }
  }

  // Infer from motherboard support mentions
  if (
    titleUpper.includes("E-ATX") ||
    titleUpper.includes("EATX") ||
    titleUpper.includes("ATX EXTENDIDA")
  ) {
    return "Full Tower";
  }

  if (
    titleUpper.includes("ATX") &&
    !titleUpper.includes("MICRO") &&
    !titleUpper.includes("MINI") &&
    !titleUpper.includes("M-ATX") &&
    !titleUpper.includes("MATX")
  ) {
    return "Mid Tower";
  }

  // Fallback: "GABINETE GAMER" without any ATX/form factor info is typically Mid Tower
  if (
    (titleUpper.includes("GABINETE") && titleUpper.includes("GAMER")) ||
    titleUpper.includes("GAMING CASE")
  ) {
    return "Mid Tower";
  }

  // Don't assume form factor - better to omit than be wrong
  return null;
}

function extractColor(title: string): string | null {
  const titleUpper = title.toUpperCase();

  // Check for color keywords - prioritize Spanish
  for (const [key, value] of Object.entries(COLORS)) {
    // Skip short keys that could be false positives in model names
    if (key.length <= 2) continue;

    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escapedKey}\\b`, "i");
    if (regex.test(title)) {
      return value;
    }
  }

  // Check short color codes at end of title or before common suffixes
  if (/\bBK\b/i.test(titleUpper)) return "Negro";
  if (/\bWH\b/i.test(titleUpper) || /\bWT\b/i.test(titleUpper)) return "Blanco";

  return null;
}

function extractFeatures(title: string): {
  tg: boolean;
  mesh: boolean;
  rgb: "ARGB" | "RGB" | null;
} {
  const titleUpper = title.toUpperCase();

  // RGB/ARGB - prefer ARGB if both present
  let rgb: "ARGB" | "RGB" | null = null;
  if (titleUpper.includes("ARGB") || titleUpper.includes("A-RGB")) {
    rgb = "ARGB";
  } else if (titleUpper.includes("RGB")) {
    rgb = "RGB";
  }

  // Panel type - Tempered Glass
  const tg =
    titleUpper.includes("VIDRIO TEMPLADO") ||
    titleUpper.includes("TEMPERED GLASS") ||
    titleUpper.includes("CRISTAL TEMPLADO") ||
    /\bTG\b/.test(titleUpper);

  // Airflow/Mesh
  const mesh = titleUpper.includes("MESH") || titleUpper.includes("AIRFLOW");

  return { tg, mesh, rgb };
}

function cleanModel(title: string, brand: string): string {
  let cleaned = title;

  // Remove brand
  const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startBoundary = /^\w/.test(brand) ? "\\b" : "";
  const endBoundary = /\w$/.test(brand) ? "\\b" : "";
  const brandRegex = new RegExp(`${startBoundary}${escapedBrand}${endBoundary}`, "gi");
  cleaned = cleaned.replace(brandRegex, "");

  // Remove common noise words (order matters - specific first, generic last)
  cleaned = cleaned
    // Product type prefixes
    .replace(/\bGABINETE\s*(GAMER|GAMING|CORPORATIVO|PREMIUM)?\b/gi, "")
    .replace(/\bGABINET[EO]?\b/gi, "")
    .replace(/\bGABIENTE\b/gi, "") // typo
    .replace(/\bGAMER\b/gi, "")
    .replace(/\bGAMING\b/gi, "")
    .replace(/\bPC\s*CASE\b/gi, "")
    .replace(/\bCASE\b/gi, "")
    .replace(/\bCORPORATIVO\b/gi, "")
    .replace(/\bPREMIUM\b/gi, "")
    .replace(/\bMODULAR\b/gi, "")
    // Form factors (extracted separately)
    .replace(/\bFULL[\s-]?TOWER\b/gi, "")
    .replace(/\bMID[\s-]?TOWER\b/gi, "")
    .replace(/\bMINI[\s-]?TOWER\b/gi, "")
    .replace(/\bMICRO[\s-]?ATX\b/gi, "")
    .replace(/\bMINI[\s-]?ITX\b/gi, "")
    .replace(/\bMINI[\s-]?DTX\b/gi, "")
    .replace(/\bE-?ATX\b/gi, "")
    .replace(/\bATX\s*EXTENDIDA\b/gi, "")
    .replace(/\bATX\b/gi, "")
    .replace(/\bMATX\b/gi, "")
    .replace(/\bM-?ATX\b/gi, "")
    .replace(/\bITX\b/gi, "")
    .replace(/\bDTX\b/gi, "")
    .replace(/\bSFF\b/gi, "")
    .replace(/\bHTPC\b/gi, "")
    .replace(/\bSLIM\b/gi, "")
    // Features (extracted separately)
    .replace(/\bVIDRIO\s*TEMPLADO\b/gi, "")
    .replace(/\bCRISTAL\s*TEMPLADO\b/gi, "")
    .replace(/\bTEMPERED\s*GLASS\b/gi, "")
    .replace(/\bPANEL\s*MALLA\b/gi, "")
    .replace(/\bMESH\b/gi, "")
    .replace(/\bAIRFLOW\b/gi, "")
    .replace(/\bA-?RGB\b/gi, "")
    .replace(/\bRGB\s*PROGRAMABLE\b/gi, "")
    .replace(/\bRGB\b/gi, "")
    // LED descriptions
    .replace(/\b\d+\s*LED\b/gi, "")
    // xRGB patterns like 2xRGB 20cm, 1xRGB 12cm
    .replace(/\b\d+[xX]RGB\s*\d+\s*(?:CM|MM)?\b/gi, "")
    .replace(/\b\d+[xX]ARGB\s*\d+\s*(?:CM|MM)?\b/gi, "")
    // Colors (extracted separately)
    .replace(/\bNEGRO\b/gi, "")
    .replace(/\bBLANCO\b/gi, "")
    .replace(/\bBLACK\b/gi, "")
    .replace(/\bWHITE\b/gi, "")
    .replace(/\bGRIS\b/gi, "")
    .replace(/\bGRAY\b/gi, "")
    .replace(/\bGREY\b/gi, "")
    .replace(/\bROJO\b/gi, "")
    .replace(/\bRED\b/gi, "")
    .replace(/\bAZUL\b/gi, "")
    .replace(/\bBLUE\b/gi, "")
    .replace(/\bVERDE\b/gi, "")
    .replace(/\bGREEN\b/gi, "")
    .replace(/\bROSA\b/gi, "")
    .replace(/\bPINK\b/gi, "")
    // Color codes at end
    .replace(/\bBK\b/gi, "")
    .replace(/\bWH\b/gi, "")
    .replace(/\bWT\b/gi, "")
    // Common specs/features noise
    .replace(/\bUSB[\s-]?C\b/gi, "")
    .replace(/\b\d*USB\s*\d\.?\d?\b/gi, "")
    .replace(/\bTYPE[\s-]?C\b/gi, "")
    .replace(/\bCON\s*FUENTE\b/gi, "")
    .replace(/\bSIN\s*FUENTE\b/gi, "")
    .replace(/\bINCLUYE\s*FUENTE\s*PODER\s*\d+W?\b/gi, "")
    .replace(/\bINCLUYE\b/gi, "")
    .replace(/\bCOLOR\b/gi, "")
    .replace(/\bPWM\b/gi, "")
    .replace(/\bFACTOR\b/gi, "")
    .replace(/\bEXTENDIDA\b/gi, "")
    // Fan descriptions - more aggressive patterns
    .replace(/\b\d+[xX]\s*\d{2,3}\s*MM\b/gi, "") // 4x120MM
    .replace(/\b\d+[xX]\d{2,3}\s*MM\b/gi, "") // 4x120MM without space
    .replace(/\b\d+[xX]\d{2,3}\b/gi, "") // 3x120 without MM (must have 2-3 digit number after x)
    .replace(/\b\d+[xX]\s*(?:FANS?|VENTILADOR(?:ES)?)\s*(?:ARGB|RGB)?\s*(?:\d+\s*MM)?\b/gi, "")
    .replace(/\b\d+\s*(?:FANS?|FAN)\b/gi, "")
    .replace(/\b\d+\s*ARGB\b/gi, "") // 1ARGB, 3 ARGB, etc
    .replace(/\b\d+\s*(?:VENTILADORES?|VENT\.?)\s*(?:ARGB|RGB|PWM)?\b/gi, "") // 4 Ventiladores ARGB
    .replace(/\b(?:FANS?|VENTILADOR(?:ES)?)\s*(?:ARGB|RGB)?\s*\d+\s*MM\b/gi, "")
    .replace(/\bVENTILADOR(?:ES)?\s*INCLUID[OA]S?\b/gi, "")
    .replace(/\bVENTILADOR(?:ES)?\b/gi, "")
    .replace(/\bINCLUID[OA]S?\b/gi, "")
    .replace(/\b\d+\s*MM\b/gi, "")
    .replace(/\b\d+CM\b/gi, "")
    .replace(/\bY\s+\d+\b/gi, "")
    .replace(/\b[1-9]x\s+(?!\d)/gi, "") // 3x followed by non-digit (single digit fan multipliers only)
    .replace(/\s+y\s+/gi, " ") // standalone y
    // Compatibility mentions
    .replace(/\bSOPORTE?\s*\d+\s*MM\b/gi, "")
    .replace(/\bSOP\.?\s*\d+\s*MM\b/gi, "")
    .replace(/\bSOP\.?\b/gi, "")
    .replace(/\bFUENTE\s*SFX\b/gi, "")
    // Cougar specific noise
    .replace(/\bPANELES\s*FRONTALES\s*INTERCAMBIABLES\s*Y\s*VENTILADORES\b/gi, "")
    .replace(/\bPANELES\s*INTERCAMBIABLES\b/gi, "")
    .replace(/\bCON\s*PANEL\s*DE\s*Y\s*AMPLIA\s*CAPACIDAD\s*DE\s*EXPANSIÓN\b/gi, "")
    .replace(/\bCON\s*PANEL\s*DE\b/gi, "")
    .replace(/\bY\s*AMPLIA\s*CAPACIDAD\s*DE\s*EXPANSIÓN\b/gi, "")
    .replace(/\bAMPLIA\s*CAPACIDAD\s*DE\s*EXPANSIÓN\b/gi, "")
    .replace(/\bCON\s*Y\s*VENTILADORES\b/gi, "")
    .replace(/\bCON\b/gi, "")
    // Part numbers - be aggressive
    .replace(/\s+P\/N\s*:?.*$/i, "")
    .replace(/\s+P\/N.*$/i, "")
    .replace(/\b0-\d{6}-\d{5}-\d\b/g, "")
    .replace(/\b\d+-\d+-\d+-\d+\b/g, "")
    .replace(/\b[A-Z]{2}-\d{4,}[A-Z0-9-]*\b/gi, "")
    .replace(/\b\d{2}DC[A-Z0-9]{4}-[A-Z0-9]+\b/gi, "") // ASUS P/N like 90DC00R3-B08000
    .replace(/\b\d{3}[A-Z]{2}\d{2}\.\d{4}\b/gi, "")
    .replace(/\b[A-Z]\d{3}-[A-Z]{4}-[A-Z]\d{2}\b/gi, "")
    .replace(/\b[A-Z]{2}\d{3}-[A-Z]{4}-[A-Z]\d{2}\b/gi, "")
    .replace(/\b[A-Z]{3}-[A-Z0-9]+-[A-Z0-9]+\b/gi, "")
    .replace(/\bGB-[A-Z0-9]+\b/gi, "")
    .replace(/\bPGW-CH-KOL-\d+-?[A-Z]?\b/gi, "")
    // ADATA/XPG P/N suffixes
    .replace(/\b-BKCWW\b/gi, "")
    .replace(/\b-WHCWW\b/gi, "")
    // Punctuation and cleanup
    .replace(/[()]/g, "")
    .replace(/\s*[,]\s*/g, " ")
    .replace(/\s*\/+\s*/g, " ")
    .replace(/\s*[-–]\s*$/g, "")
    .replace(/^\s*[-–]\s*/g, "")
    .replace(/\s+-\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Brand-specific model cleanup
  if (brand === "Corsair") {
    cleaned = cleaned
      .replace(/\bCC-\d+[A-Z]*-[A-Z0-9]+\b/gi, "")
      .replace(/\bVIDRIO\b/gi, "")
      .replace(/\bVIdrio\b/gi, "");
  }

  if (brand === "Antec") {
    cleaned = cleaned
      .replace(/\bELITE\b/gi, "Elite")
      .replace(/\bFLUX\b/gi, "Flux")
      .replace(/\bPERFORMANCE\s*1\b/gi, "Performance 1") // Preserve "Performance 1" as model
      .replace(/\bPERFORMANCE\b/gi, "Performance")
      .replace(/\bWOOD\b/gi, "Wood");
  }

  if (brand === "Cooler Master") {
    cleaned = cleaned
      .replace(/\bCOOLERMASTER\b/gi, "")
      .replace(/\bMASTERBOX\b/gi, "MasterBox")
      .replace(/\bHAF\b/gi, "HAF")
      .replace(/\bEN KIT\b/gi, "")
      .replace(/\bWATER COOLING AIO \d+\b/gi, "")
      .replace(/\b\d+W GXII GOLD\b/gi, "")
      .replace(/\bGXII\b/gi, "")
      .replace(/\bELITE\b/gi, "Elite")
      .replace(/\bPROGRAMABLE\b/gi, "");
  }

  if (brand === "Be quiet!") {
    cleaned = cleaned
      .replace(/\bBE QUIET!?\b/gi, "")
      .replace(/\bLIGHT BASE\b/gi, "Light Base")
      .replace(/\bSHADOW BASE\b/gi, "Shadow Base")
      .replace(/\bPURE BASE\b/gi, "Pure Base")
      .replace(/\bDARK BASE\b/gi, "Dark Base")
      .replace(/\bSILENT BASE\b/gi, "Silent Base")
      .replace(/\bPURE WINGS\s*\d*\b/gi, "")
      .replace(/\b\d+x\b/gi, ""); // 3x
  }

  if (brand === "NZXT") {
    cleaned = cleaned.replace(/\bH\d+\b/gi, (match) => match.toUpperCase());
  }

  if (brand === "Lian Li") {
    cleaned = cleaned.replace(/\bLANCOOL\b/gi, "Lancool").replace(/\bO11\b/gi, "O11");
  }

  if (brand === "Gigabyte") {
    cleaned = cleaned
      .replace(/\bPANORAMIC\b/gi, "Panoramic")
      .replace(/\bSTEALTH\b/gi, "Stealth")
      .replace(/\bICE\b/gi, "Ice")
      .replace(/\bGB-/gi, "")
      .replace(/\bGLASS\b/gi, "Glass");
  }

  if (brand === "ASUS") {
    cleaned = cleaned
      .replace(/\bPROART\b/gi, "ProArt")
      .replace(/\bROG\b/gi, "ROG")
      .replace(/\bTG\b/gi, "")
      .replace(/\bEDITION\b/gi, "Edition")
      .replace(/\bWOOD\b/gi, "Wood");
  }

  if (brand === "Cougar") {
    cleaned = cleaned
      .replace(/\bDUOFACE\b/gi, "Duoface")
      .replace(/\bPANZER\b/gi, "Panzer")
      .replace(/\bARCHON\b/gi, "Archon")
      .replace(/\bUNIFACE\b/gi, "Uniface")
      .replace(/\bFV\d+\b/gi, (match) => match.toUpperCase())
      .replace(/\bPANELES\s*FRONTALES\s*INTERCAMBIABLES\s*Y\b/gi, "")
      .replace(/\bPANELES\s*FRONTALES\s*INTERCAMBIABLES\b/gi, "")
      .replace(/\bY\s*VENTILADORES\b/gi, "");
  }

  if (brand === "XPG" || brand === "ADATA") {
    cleaned = cleaned
      .replace(/\bADATA\b/gi, "")
      .replace(/\bXPG\b/gi, "")
      .replace(/\bCRUISER\s*ST\b/gi, "Cruiser ST")
      .replace(/\bCRUISERST\b/gi, "Cruiser ST")
      .replace(/\bCRUISER\b/gi, "Cruiser")
      .replace(/\bDEFENDER\s*PRO\b/gi, "Defender Pro")
      .replace(/\bDEFENDERPRO\b/gi, "Defender Pro")
      .replace(/\bDEFENDER\b/gi, "Defender")
      .replace(/\bPRO\b/gi, "Pro");
  }

  if (brand === "Gamemax") {
    cleaned = cleaned
      .replace(/\bSTARLIGHT\b/gi, "Starlight")
      .replace(/\bBLADE\b/gi, "Blade")
      .replace(/\bCONCEPT\b/gi, "Concept")
      .replace(/\bDIAMOND\b/gi, "Diamond")
      .replace(/\bCP\b/gi, "CP")
      .replace(/\b2AB\b/gi, "")
      .replace(/\b\d+xARGB\b/gi, "")
      .replace(/\bmATX\b/gi, "")
      .replace(/\b1\s*$/g, ""); // trailing 1 from "1 USB-C"
  }

  if (brand === "Aerocool") {
    cleaned = cleaned
      .replace(/\bAIRHAWK\b/gi, "Airhawk")
      .replace(/\bDUO\b/gi, "Duo")
      .replace(/\b\d+[xX]RGB\s*\d+\s*(?:CM|MM)?\b/gi, "") // 2xRGB 20cm
      .replace(/\b\d+[xX]RGB\b/gi, ""); // 1xRGB
  }

  if (brand === "Kolink") {
    cleaned = cleaned
      .replace(/\bINSPIRE\s*SERIES\b/gi, "Inspire")
      .replace(/\bINSPIRE\b/gi, "Inspire")
      .replace(/\bVOID\b/gi, "Void")
      .replace(/\bSERIES\b/gi, "")
      .replace(/\bMINI\b/gi, "");
  }

  if (brand === "APNX") {
    cleaned = cleaned
      .replace(/\bCREATOR\b/gi, "Creator")
      .replace(/\bCHROMAFLAIR\b/gi, "ChromaFlair")
      .replace(/\bLIMITED EDITION\b/gi, "Limited Edition");
  }

  if (brand === "Clio") {
    cleaned = cleaned
      .replace(/\bMADO\b/gi, "Mado")
      .replace(/\bMICRO\s*M\d+\b/gi, (match) => match.replace(/\s+/g, " "))
      .replace(/\bP3B\b/gi, "P3B")
      .replace(/\b3[,.]?0\b/gi, "") // USB 3.0 or 3,0
      .replace(/\b\d+\s*FAN\b/gi, "") // 3 FAN
      .replace(/\s+0\b/g, ""); // residual 0
  }

  if (brand === "Thermaltake") {
    cleaned = cleaned.replace(/\bDIVIDER\b/gi, "Divider").replace(/\bTG\b/gi, "");
  }

  // Final cleanup
  cleaned = cleaned
    .replace(/\s+/g, " ")
    .replace(/^[-–,.\s]+/, "")
    .replace(/[-–,.\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  // Remove any remaining P/N like patterns
  cleaned = cleaned.replace(/\b[A-Z0-9]{2,}-[A-Z0-9]{4,}-[A-Z0-9]+\b/gi, "").trim();

  // Title case words that are all lowercase and > 2 chars
  cleaned = cleaned.replace(/\b([a-z]{3,})\b/g, (match) => {
    return match.charAt(0).toUpperCase() + match.slice(1);
  });

  return cleaned;
}

/** Normaliza el título del gabinete a formato estándar */
export function normalizeCaseTitle(title: string, mpn?: string, manufacturer?: string): string {
  // 1. Clean HTML entities
  const cleanTitle = cleanHtmlEntities(title);

  // 2. Extract Components
  const brand = extractBrand(cleanTitle, manufacturer) || "Generic";
  const formFactor = extractFormFactor(cleanTitle);
  const color = extractColor(cleanTitle);
  const features = extractFeatures(cleanTitle);

  // 3. Extract and Clean Model
  let model = cleanModel(cleanTitle, brand);

  // If model is empty or too short, try to extract from MPN
  if ((!model || model.length < 2) && mpn) {
    model = mpn
      .replace(/^[A-Z]{2,3}-\d{4,}/, "")
      .replace(/-[A-Z]{2,3}$/, "")
      .trim();
  }

  // 4. Build Normalized Title
  const parts: string[] = [];

  // [Brand]
  parts.push(brand);

  // [Model]
  if (model) {
    parts.push(model);
  }

  // [Form Factor] - only if not implied by model name
  if (formFactor) {
    const modelLower = model.toLowerCase();
    const hasFormFactorInModel =
      modelLower.includes("tower") ||
      modelLower.includes("cube") ||
      modelLower.includes("htpc") ||
      modelLower.includes("sff");
    if (!hasFormFactorInModel) {
      parts.push(formFactor);
    }
  }

  // [Features] - TG first, then Mesh, then RGB
  if (features.tg) {
    if (!model.toUpperCase().includes("TG") && !model.toLowerCase().includes("glass")) {
      parts.push("TG");
    }
  }
  if (features.mesh) {
    if (!model.toLowerCase().includes("mesh") && !model.toLowerCase().includes("airflow")) {
      parts.push("Mesh");
    }
  }
  if (features.rgb) {
    if (!model.toUpperCase().includes("ARGB") && !model.toUpperCase().includes("RGB")) {
      parts.push(features.rgb);
    }
  }

  // [Color]
  if (color) {
    parts.push(color);
  }

  // 5. Final Cleanup - remove duplicates
  const uniqueParts = parts.filter((item, index) => {
    const lowerItem = item.toLowerCase();
    return parts.findIndex((p) => p.toLowerCase() === lowerItem) === index;
  });

  return uniqueParts.join(" ");
}

// Export for direct access
export const CaseNormalizer = {
  normalize: normalizeCaseTitle,
  extractBrand,
  extractFormFactor,
  extractColor,
  extractFeatures,
};
