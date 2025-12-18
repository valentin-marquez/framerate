/**
 * Normalizador de Títulos de Coolers de CPU
 *
 * Normaliza los títulos de coolers (refrigeradores) de CPU a un formato consistente.
 * Maneja tanto AIOs (All-In-One líquidos) como coolers de aire.
 *
 * Formato: "Marca Modelo Tamaño Tipo [Características]"
 * Ejemplos:
 *   - "Cooler Master MasterLiquid 360 Core II AIO ARGB White"
 *   - "NZXT Kraken Elite 240 AIO LCD"
 *   - "Be Quiet! Dark Rock Pro 5 Air"
 *   - "Cougar Forza 85 Air ARGB"
 *
 * ADVERTENCIA: Este código es horrible y necesita refactorización urgente.
 * TODO: Mejorar esta atrocidad de normalización cuando tengamos tiempo (nunca).
 * talvez con ML/AI o algo similar.
 */

import { cleanHtmlEntities } from "./utils";

/** Configuración de marcas de coolers con sus keywords de identificación */

const BRANDS: Record<string, { name: string; keywords: string[] }> = {
  COOLER_MASTER: {
    name: "Cooler Master",
    keywords: ["COOLER MASTER", "COOLERMASTER", "MLW-", "MLX-", "MLY-"],
  },
  NZXT: {
    name: "NZXT",
    keywords: ["NZXT", "RL-KR", "RL-KN", "RL- KR", "RL- KN"],
  },
  ANTEC: {
    name: "Antec",
    keywords: ["ANTEC", "0-761345"],
  },
  CORSAIR: {
    name: "Corsair",
    keywords: ["CORSAIR", "CW-"],
  },
  BE_QUIET: {
    name: "Be Quiet!",
    keywords: ["BE QUIET", "BEQUIET", "BK0"],
  },
  COUGAR: {
    name: "Cougar",
    keywords: ["COUGAR", "CGR-", "3MFZ"],
  },
  DEEPCOOL: {
    name: "DeepCool",
    keywords: ["DEEPCOOL", "DEEP COOL"],
  },
  GAMEMAX: {
    name: "Gamemax",
    keywords: ["GAMEMAX"],
  },
  GIGABYTE: {
    name: "Gigabyte",
    keywords: ["GIGABYTE", "GP-AORUS", "AORUS"],
  },
  MSI: {
    name: "MSI",
    keywords: ["MSI", "MPG CORELIQUID", "MPGCORELIQUID"],
  },
  THERMALTAKE: {
    name: "Thermaltake",
    keywords: ["THERMALTAKE", "CL-W"],
  },
  ARCTIC: {
    name: "Arctic",
    keywords: ["ARCTIC"],
  },
  NOCTUA: {
    name: "Noctua",
    keywords: ["NOCTUA", "NH-"],
  },
  ID_COOLING: {
    name: "ID-Cooling",
    keywords: ["ID-COOLING", "IDCOOLING"],
  },
  GAMDIAS: {
    name: "Gamdias",
    keywords: ["GAMDIAS", "CHIONE"],
  },
  XYZ: {
    name: "XYZ",
    keywords: ["XYZ", "X-AC-"],
  },
  MORPHEUS: {
    name: "Morpheus",
    keywords: ["MORPHEUS"],
  },
  INTEL: {
    name: "Intel",
    keywords: ["INTEL ORIGINAL", "INTEL"],
  },
  AMD: {
    name: "AMD",
    keywords: ["AMD ORIGINAL", "AMD"],
  },
};

/** Interfaz para definir líneas de productos de coolers */
interface ProductLine {
  name: string;
  keywords: string[];
  type: "aio" | "air";
}

const PRODUCT_LINES: Record<string, ProductLine[]> = {
  COOLER_MASTER: [
    {
      name: "MasterLiquid",
      keywords: ["MASTERLIQUID", "ML240", "ML280", "ML360"],
      type: "aio",
    },
    { name: "MasterAir", keywords: ["MASTERAIR"], type: "air" },
    { name: "Hyper", keywords: ["HYPER"], type: "air" },
  ],
  NZXT: [
    {
      name: "Kraken Elite",
      keywords: ["KRAKEN ELITE", "KR24E", "KR36E"],
      type: "aio",
    },
    {
      name: "Kraken Plus",
      keywords: ["KRAKEN PLUS", "KN24", "KN36"],
      type: "aio",
    },
    { name: "Kraken", keywords: ["KRAKEN"], type: "aio" },
  ],
  ANTEC: [
    { name: "Skeleton", keywords: ["SKELETON"], type: "aio" },
    { name: "Vortex Lum", keywords: ["VORTEX LUM"], type: "aio" },
    { name: "Vortex", keywords: ["VORTEX"], type: "aio" },
    { name: "Symphony", keywords: ["SYMPHONY"], type: "aio" },
    { name: "Neptune", keywords: ["NEPTUNE"], type: "aio" },
    { name: "A30 Pro", keywords: ["A30 PRO", "A30PRO"], type: "air" },
  ],
  BE_QUIET: [
    { name: "Dark Rock Pro", keywords: ["DARK ROCK PRO"], type: "air" },
    { name: "Dark Rock", keywords: ["DARK ROCK"], type: "air" },
    { name: "Pure Rock", keywords: ["PURE ROCK"], type: "air" },
    { name: "Shadow Rock", keywords: ["SHADOW ROCK"], type: "air" },
    { name: "Silent Loop", keywords: ["SILENT LOOP"], type: "aio" },
  ],
  COUGAR: [
    { name: "Forza", keywords: ["FORZA"], type: "air" },
    { name: "Helor", keywords: ["HELOR"], type: "aio" },
    { name: "Aqua", keywords: ["AQUA"], type: "aio" },
  ],
  GAMEMAX: [
    { name: "Iceburg", keywords: ["ICEBURG"], type: "aio" },
    { name: "Sigma", keywords: ["SIGMA"], type: "air" },
    {
      name: "Ice Surface",
      keywords: ["ICE SURFACE", "ICE-SURFACE"],
      type: "air",
    },
    { name: "Gamma", keywords: ["GAMMA"], type: "air" },
  ],
  GIGABYTE: [
    {
      name: "AORUS Waterforce X II",
      keywords: ["WATERFORCE X II"],
      type: "aio",
    },
    { name: "AORUS Waterforce", keywords: ["WATERFORCE"], type: "aio" },
  ],
  MSI: [
    { name: "MAG CoreLiquid", keywords: ["MAG CORELIQUID"], type: "aio" },
    {
      name: "MPG CoreLiquid",
      keywords: ["MPG CORELIQUID", "MPGCORELIQUID"],
      type: "aio",
    },
  ],
  GAMDIAS: [{ name: "Chione", keywords: ["CHIONE"], type: "aio" }],
  XYZ: [{ name: "Thermax", keywords: ["THERMAX"], type: "air" }],
  MORPHEUS: [
    { name: "Gaming", keywords: ["GAMING"], type: "air" },
    { name: "G20", keywords: ["G20"], type: "air" },
    { name: "A100", keywords: ["A100"], type: "air" },
    { name: "TJ400", keywords: ["TJ400"], type: "air" },
    { name: "RF-P2", keywords: ["RF-P2"], type: "air" },
  ],
};

// ============================================================================
// Junk Terms to Remove
// ============================================================================

const JUNK_TERMS = [
  // Verbose product type descriptors
  "REFRIGERACION LIQUIDA",
  "REFRIGERACIÓN LÍQUIDA",
  "REGRIGERACION LIQUIDA", // typo
  "SISTEMA DE REFRIGERACION LIQUIDA",
  "SISTEMA DE REGRIGERACION LIQUIDA", // typo
  "WATER COOLING",
  "WATERCOOLING",
  "VENTILADOR PARA CPU",
  "VENTILADORES PARA CPU",
  "DISIPADOR PARA CPU",
  "DISIPADOR DE CPU",
  "DISIPADOR CPU",
  "DISIPADOR DE PROCESADOR",
  "DISIPADOR",
  "ENFRIADOR DE CPU",
  "ENFRIADOR",
  "CPU COOLER",
  "COOLER CPU",
  "ENFRIAMIENTO EFICAZ",
  "TORRE ÚNICA",
  "TORRE UNICA",
  "NIVEL BÁSICO",
  "NIVEL BASICO",
  // Spanish articles and prepositions
  "PARA",
  "CON",
  "DE",
  "EL",
  "LA",
  "LOS",
  "LAS",
  // Marketing terms
  "VENTILADOR INTEGRADO",
  "DISIPADOR CON VENTILADOR INTEGRADO",
  "ILUMINACIÓN ARGB",
  "ILUMINACION ARGB",
  "ILUMINACIÓN RGB",
  "ILUMINACION RGB",
  // Part number prefixes
  "P/N",
  "P/n",
  "MPN",
  // Socket compatibility mentions (we keep the important ones in features)
  "S1700 READY",
  "S1700 Y AM5",
  "S1700 Y AM4",
  "AM5 READY",
  "( S1700 READY Y AM5 )",
  "( S1700 Y AM5 )",
  "( S1700 Y AM4 )",
  // Generic terms
  "EDITION",
  "EDICION",
  "DYNAMIC",
];

// ============================================================================
// Helper Functions
// ============================================================================

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Detect the brand from the title or MPN
 */
function detectBrand(title: string, mpn?: string, manufacturer?: string): string | null {
  const titleUpper = title.toUpperCase();
  const mpnUpper = mpn?.toUpperCase() || "";

  for (const brand of Object.values(BRANDS)) {
    const found = brand.keywords.some((kw) => titleUpper.includes(kw) || mpnUpper.includes(kw));
    if (found) {
      return brand.name;
    }
  }

  // Fallback to manufacturer if provided
  if (manufacturer) {
    const mfrUpper = manufacturer.toUpperCase();
    for (const brand of Object.values(BRANDS)) {
      if (brand.name.toUpperCase() === mfrUpper) {
        return brand.name;
      }
    }
    // Return manufacturer as-is if not found in known brands
    return manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1).toLowerCase();
  }

  return null;
}

/**
 * Get the brand key for looking up product lines
 */
function getBrandKey(brandName: string): string | null {
  for (const [key, brand] of Object.entries(BRANDS)) {
    if (brand.name.toUpperCase() === brandName.toUpperCase()) {
      return key;
    }
  }
  return null;
}

/**
 * Detect the product line from the title
 */
function detectProductLine(title: string, brandKey: string | null): { name: string; type: "aio" | "air" } | null {
  const titleUpper = title.toUpperCase();

  if (brandKey && PRODUCT_LINES[brandKey]) {
    for (const line of PRODUCT_LINES[brandKey]) {
      const found = line.keywords.some((kw) => titleUpper.includes(kw));
      if (found) {
        return { name: line.name, type: line.type };
      }
    }
  }

  return null;
}

/**
 * Detect if the cooler is an AIO or air cooler from context
 */
function detectCoolerType(title: string): "aio" | "air" | null {
  const titleUpper = title.toUpperCase();

  // AIO indicators
  const aioKeywords = [
    "REFRIGERACION LIQUIDA",
    "REFRIGERACIÓN LÍQUIDA",
    "REGRIGERACION LIQUIDA",
    "WATER COOLING",
    "WATERCOOLING",
    "LIQUIDA",
    "LIQUID",
    "AIO",
    "240MM",
    "280MM",
    "360MM",
    "420MM",
    "120MM RADIATOR",
    "240MM RADIATOR",
    "RADIADOR",
    "LCD",
    "IPS",
  ];

  // Air cooler indicators
  const airKeywords = [
    "DISIPADOR",
    "VENTILADOR PARA CPU",
    "TOWER COOLER",
    "TORRE",
    "HEATPIPES",
    "HEAT PIPES",
    "HEATPIPE",
  ];

  const isAio = aioKeywords.some((kw) => titleUpper.includes(kw));
  const isAir = airKeywords.some((kw) => titleUpper.includes(kw));

  if (isAio && !isAir) return "aio";
  if (isAir && !isAio) return "air";

  return null;
}

/**
 * Extract radiator/cooler size (120, 240, 280, 360mm)
 */
function extractSize(title: string): string | null {
  const titleUpper = title.toUpperCase();

  // Common AIO radiator sizes - standalone
  const sizeMatch = titleUpper.match(/\b(120|240|280|360|420)\s*(?:MM)?\b/);
  if (sizeMatch) {
    return `${sizeMatch[1]}mm`;
  }

  // Size embedded in model number (e.g., ML280, K240, K360)
  const embeddedMatch = titleUpper.match(/(?:ML|K|L)(\d{3})\b/);
  if (embeddedMatch) {
    const size = embeddedMatch[1];
    if (["120", "240", "280", "360", "420"].includes(size)) {
      return `${size}mm`;
    }
  }

  return null;
}

/**
 * Extract model variant/version (e.g., "Core II", "V2", "Pro", "Plus")
 */
function extractVariant(title: string): string | null {
  const titleUpper = title.toUpperCase();
  const variants: string[] = [];

  // Version patterns
  if (/\bCORE\s*II\b/.test(titleUpper)) variants.push("Core II");
  else if (/\bCORE\b/.test(titleUpper)) variants.push("Core");

  if (/\bV2\b/.test(titleUpper)) variants.push("V2");
  if (/\bPRO\s*5\b/.test(titleUpper)) variants.push("5");
  else if (/\bPRO\s*3\b/.test(titleUpper)) variants.push("3");
  else if (/\bPRO\b/.test(titleUpper) && !titleUpper.includes("A30 PRO")) variants.push("Pro");

  if (/\bLX\b/.test(titleUpper)) variants.push("LX");
  if (/\bDUO\b/.test(titleUpper)) variants.push("Duo");

  // Model numbers for specific brands
  const modelNumberMatch = titleUpper.match(/\b(\d{2,3})\s*(?:ARGB|ESSENTIAL|DIGITAL)\b/);
  if (modelNumberMatch) {
    variants.unshift(modelNumberMatch[1]); // Add at start
  }

  return variants.length > 0 ? variants.join(" ") : null;
}

/**
 * Extract features (ARGB, RGB, LCD, Digital, etc.)
 */
function extractFeatures(title: string): string[] {
  const titleUpper = title.toUpperCase();
  const features: string[] = [];

  // Lighting
  if (titleUpper.includes("ARGB")) {
    features.push("ARGB");
  } else if (titleUpper.includes("RGB")) {
    features.push("RGB");
  }

  // Display features
  if (/\b\d+(\.\d+)?["'']\s*(?:IPS\s*)?LCD\b/.test(titleUpper) || titleUpper.includes("IPS LCD")) {
    features.push("LCD");
  } else if (titleUpper.includes("LCD") || titleUpper.includes("DISPLAY")) {
    features.push("LCD");
  }

  if (titleUpper.includes("DIGITAL")) {
    features.push("Digital");
  }

  // Special variants
  if (titleUpper.includes("ESSENTIAL")) {
    features.push("Essential");
  }

  if (titleUpper.includes("SPECTRUM")) {
    features.push("Spectrum");
  }

  if (titleUpper.includes("MIRROR")) {
    features.push("Mirror");
  }

  if (titleUpper.includes("FLUX")) {
    features.push("Flux");
  }

  if (titleUpper.includes("VIVID")) {
    features.push("Vivid");
  }

  if (titleUpper.includes("ILLUSION")) {
    features.push("Illusion");
  }

  return features;
}

/**
 * Extract color (White, Black)
 */
function extractColor(title: string): string | null {
  const titleUpper = title.toUpperCase();

  if (titleUpper.includes("WHITE") || titleUpper.includes("BLANCO") || titleUpper.includes("WITHE")) {
    // typo
    return "White";
  }

  if (
    titleUpper.includes("BLACK") ||
    titleUpper.includes("NEGRO") ||
    titleUpper.includes("BK") ||
    titleUpper.includes("BLK")
  ) {
    return "Black";
  }

  return null;
}

/**
 * Extract heatpipe count for air coolers
 */
function extractHeatpipes(title: string): number | null {
  const match = title.match(/(\d+)\s*(?:HEAT\s*PIPES?|HEATPIPES?)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

// ============================================================================
// Main Normalizer Function
// ============================================================================

/**
 * Normalizes a CPU cooler product title to a consistent format
 *
 * @param title - Original product title
 * @param mpn - Product MPN (optional)
 * @param manufacturer - Manufacturer from specs (optional)
 * @returns Normalized title
 *
 * Examples:
 *   - "REFRIGERACION LIQUIDA COOLER MASTER MASTERLIQUID 360 CORE II WHITE EDITION"
 *     → "Cooler Master MasterLiquid 360mm Core II AIO White"
 *
 *   - "Disipador para CPU COUGAR Forza 85 ARGB - Disipador de Torre Única con Iluminación ARGB"
 *     → "Cougar Forza 85 Air ARGB"
 *
 *   - "REFRIGERACION LIQUIDA NZXT Kraken Elite 240 2.72" IPS LCD BLACK"
 *     → "NZXT Kraken Elite 240mm AIO LCD Black"
 */
export function normalizeCpuCoolerTitle(title: string, mpn?: string, manufacturer?: string): string {
  const cleaned = cleanHtmlEntities(title);

  // 1. Detect brand
  const brand = detectBrand(cleaned, mpn, manufacturer);
  const brandKey = brand ? getBrandKey(brand) : null;

  // 2. Detect product line and cooler type
  const productLine = detectProductLine(cleaned, brandKey);
  let coolerType = productLine?.type || detectCoolerType(cleaned);

  // 3. Extract size
  const size = extractSize(cleaned);

  // If we have a size like 240, 280, 360 it's likely an AIO
  if (size && ["240mm", "280mm", "360mm", "420mm"].includes(size) && !coolerType) {
    coolerType = "aio";
  }

  // 4. Extract variant
  const variant = extractVariant(cleaned);

  // 5. Extract features
  const features = extractFeatures(cleaned);

  // 6. Extract color
  const color = extractColor(cleaned);

  // 7. Extract heatpipes (for air coolers)
  const heatpipes = extractHeatpipes(cleaned);

  // 8. Remove junk terms and clean up
  let workingTitle = cleaned.toUpperCase();

  // Remove MPN from title if present
  if (mpn) {
    workingTitle = workingTitle.replace(new RegExp(escapeRegExp(mpn.toUpperCase()), "g"), "");
  }

  // Remove P/N codes
  workingTitle = workingTitle.replace(/P\/N\s*:?\s*[\w\-.\s]+$/i, "");
  workingTitle = workingTitle.replace(/\b\d+-\d+-\d+-\d+\b/g, ""); // Part numbers like 0-761345-40066-4

  // Remove junk terms
  for (const term of JUNK_TERMS) {
    workingTitle = workingTitle.replace(new RegExp(escapeRegExp(term), "gi"), " ");
  }

  // 9. Build the normalized title
  const parts: string[] = [];

  // Brand
  if (brand) {
    parts.push(brand);
  }

  // Product line
  if (productLine) {
    parts.push(productLine.name);
  } else {
    // Try to extract model name from what remains
    // Clean up and extract potential model
    let modelName = workingTitle
      .replace(new RegExp(escapeRegExp(brand?.toUpperCase() || ""), "g"), "")
      .replace(/\s+/g, " ")
      .trim();

    // Remove extracted values to find remaining model info
    if (size) modelName = modelName.replace(size.replace("mm", ""), "");
    for (const feat of features) {
      modelName = modelName.replace(new RegExp(escapeRegExp(feat.toUpperCase()), "g"), "");
    }
    if (color) {
      modelName = modelName.replace(/WHITE|BLANCO|WITHE/gi, "").replace(/BLACK|NEGRO|BK\b|BLK\b/gi, "");
    }

    modelName = modelName.replace(/\s+/g, " ").trim();

    // Title case the model name if we have one
    if (modelName && modelName.length > 2) {
      modelName = modelName
        .split(" ")
        .filter((w) => w.length > 0)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ")
        .slice(0, 30); // Limit length

      // Only add if it looks like a valid model name
      if (!/^[0-9\s-]+$/.test(modelName)) {
        parts.push(modelName);
      }
    }
  }

  // Variant (Core II, Pro, etc.)
  if (variant && productLine) {
    parts.push(variant);
  }

  // Size
  if (size) {
    parts.push(size);
  }

  // Heatpipes (for air coolers without size)
  if (heatpipes && coolerType === "air" && !size) {
    parts.push(`${heatpipes} Heatpipes`);
  }

  // Cooler type
  if (coolerType === "aio") {
    parts.push("AIO");
  } else if (coolerType === "air") {
    parts.push("Air");
  }

  // Features (ARGB, LCD, etc.)
  for (const feature of features) {
    if (!parts.some((p) => p.toUpperCase() === feature.toUpperCase())) {
      parts.push(feature);
    }
  }

  // Color
  if (color) {
    parts.push(color);
  }

  // Build final title
  let finalTitle = parts.join(" ");

  // Clean up any double spaces or weird characters
  finalTitle = finalTitle.replace(/\s+/g, " ").trim();

  // If title is too short or empty, return cleaned original
  if (finalTitle.length < 5) {
    return cleanHtmlEntities(title);
  }

  return finalTitle;
}

// ============================================================================
// Exports
// ============================================================================

export const CpuCoolerNormalizer = {
  normalize: normalizeCpuCoolerTitle,
  detectBrand,
  detectProductLine,
  detectCoolerType,
  extractSize,
  extractFeatures,
};
