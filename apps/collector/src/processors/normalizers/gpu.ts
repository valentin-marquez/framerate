/**
 * GPU Title Normalizer
 * Normalizes GPU product titles to a consistent format
 * Format: "Brand Model VRAM Variant"
 * Example: "ASUS TUF RTX 5060 Ti 8GB OC"
 */

import type { BrandModel } from "./types";
import { cleanHtmlEntities } from "./utils";

// ============================================================================
// GPU Chip Detection
// ============================================================================

interface GpuChip {
  manufacturer: "NVIDIA" | "AMD" | "Intel";
  series: string;
  model: string;
  variant?: string; // Ti, XT, Super, etc.
}

/**
 * Detects NVIDIA GPU model from title
 */
function detectNvidiaChip(title: string): GpuChip | null {
  const titleUpper = title.toUpperCase();

  // Workstation cards (Quadro/RTX A-series)
  if (titleUpper.includes("QUADRO") || titleUpper.match(/RTX\s*A\d{3,4}/)) {
    const rtxAMatch = titleUpper.match(/RTX\s*A?\s*(\d{3,4})/);
    if (rtxAMatch) {
      return {
        manufacturer: "NVIDIA",
        series: "RTX A",
        model: rtxAMatch[1],
      };
    }
  }

  // RTX 50 Series
  const rtx50Match = titleUpper.match(/RTX\s*50(\d{2})\s*(TI|SUPER)?/i);
  if (rtx50Match) {
    return {
      manufacturer: "NVIDIA",
      series: "RTX 50",
      model: `50${rtx50Match[1]}`,
      variant: rtx50Match[2]?.toUpperCase(),
    };
  }

  // RTX 40 Series
  const rtx40Match = titleUpper.match(/RTX\s*40(\d{2})\s*(TI|SUPER)?/i);
  if (rtx40Match) {
    return {
      manufacturer: "NVIDIA",
      series: "RTX 40",
      model: `40${rtx40Match[1]}`,
      variant: rtx40Match[2]?.toUpperCase(),
    };
  }

  // RTX 30 Series
  const rtx30Match = titleUpper.match(/RTX\s*30(\d{2})\s*(TI|SUPER)?/i);
  if (rtx30Match) {
    return {
      manufacturer: "NVIDIA",
      series: "RTX 30",
      model: `30${rtx30Match[1]}`,
      variant: rtx30Match[2]?.toUpperCase(),
    };
  }

  // RTX 20 Series
  const rtx20Match = titleUpper.match(/RTX\s*20(\d{2})\s*(TI|SUPER)?/i);
  if (rtx20Match) {
    return {
      manufacturer: "NVIDIA",
      series: "RTX 20",
      model: `20${rtx20Match[1]}`,
      variant: rtx20Match[2]?.toUpperCase(),
    };
  }

  // GTX 16 Series
  const gtx16Match = titleUpper.match(/GTX\s*16(\d{2})\s*(TI|SUPER)?/i);
  if (gtx16Match) {
    return {
      manufacturer: "NVIDIA",
      series: "GTX 16",
      model: `16${gtx16Match[1]}`,
      variant: gtx16Match[2]?.toUpperCase(),
    };
  }

  // GTX 10 Series
  const gtx10Match = titleUpper.match(/GTX\s*10(\d{2})\s*(TI)?/i);
  if (gtx10Match) {
    return {
      manufacturer: "NVIDIA",
      series: "GTX 10",
      model: `10${gtx10Match[1]}`,
      variant: gtx10Match[2]?.toUpperCase(),
    };
  }

  // GT Series (entry level)
  const gtMatch = titleUpper.match(/GT\s*(\d{3,4})/i);
  if (gtMatch) {
    return {
      manufacturer: "NVIDIA",
      series: "GT",
      model: gtMatch[1],
    };
  }

  return null;
}

/**
 * Detects AMD GPU model from title
 */
function detectAmdChip(title: string): GpuChip | null {
  const titleUpper = title.toUpperCase();

  // RX 9000 Series (RDNA 4)
  const rx9000Match = titleUpper.match(/(?:RX|RADEON)\s*90(\d{2})\s*(XT)?/i);
  if (rx9000Match) {
    return {
      manufacturer: "AMD",
      series: "RX 9000",
      model: `90${rx9000Match[1]}`,
      variant: rx9000Match[2]?.toUpperCase(),
    };
  }

  // RX 7000 Series (RDNA 3)
  const rx7000Match = titleUpper.match(/(?:RX|RADEON)\s*7(\d{3})\s*(XT|XTX)?/i);
  if (rx7000Match) {
    return {
      manufacturer: "AMD",
      series: "RX 7000",
      model: `7${rx7000Match[1]}`,
      variant: rx7000Match[2]?.toUpperCase(),
    };
  }

  // RX 6000 Series (RDNA 2)
  const rx6000Match = titleUpper.match(/(?:RX|RADEON)\s*6(\d{3})\s*(XT)?/i);
  if (rx6000Match) {
    return {
      manufacturer: "AMD",
      series: "RX 6000",
      model: `6${rx6000Match[1]}`,
      variant: rx6000Match[2]?.toUpperCase(),
    };
  }

  // RX 5000 Series (RDNA 1)
  const rx5000Match = titleUpper.match(/(?:RX|RADEON)\s*5(\d{3})\s*(XT)?/i);
  if (rx5000Match) {
    return {
      manufacturer: "AMD",
      series: "RX 5000",
      model: `5${rx5000Match[1]}`,
      variant: rx5000Match[2]?.toUpperCase(),
    };
  }

  return null;
}

/**
 * Detects Intel GPU model from title
 */
function detectIntelChip(title: string): GpuChip | null {
  const titleUpper = title.toUpperCase();

  // Intel Arc B-series (Battlemage)
  const arcBMatch = titleUpper.match(/ARC\s*B(\d{3})/i);
  if (arcBMatch) {
    return {
      manufacturer: "Intel",
      series: "Arc B",
      model: `B${arcBMatch[1]}`,
    };
  }

  // Intel Arc A-series (Alchemist)
  const arcAMatch = titleUpper.match(/ARC\s*A(\d{3})/i);
  if (arcAMatch) {
    return {
      manufacturer: "Intel",
      series: "Arc A",
      model: `A${arcAMatch[1]}`,
    };
  }

  return null;
}

/**
 * Detects GPU chip from title
 */
function detectGpuChip(title: string): GpuChip | null {
  // Try NVIDIA first (most common)
  const nvidia = detectNvidiaChip(title);
  if (nvidia) return nvidia;

  // Then AMD
  const amd = detectAmdChip(title);
  if (amd) return amd;

  // Finally Intel
  const intel = detectIntelChip(title);
  if (intel) return intel;

  return null;
}

/** Marcas AIB (Add-In Board) conocidas y sus líneas de productos */
const GPU_BRANDS: Record<
  string,
  { name: string; keywords: string[]; lines: Record<string, string[]> }
> = {
  ASUS: {
    name: "ASUS",
    keywords: ["ASUS"],
    lines: {
      "ROG Strix": ["ROG STRIX", "ROG-STRIX", "STRIX"],
      "ROG Astral": ["ROG ASTRAL", "ROG-ASTRAL", "ASTRAL"],
      TUF: ["TUF GAMING", "TUF-", "TUF "],
      Dual: ["DUAL-", "DUAL "],
      Prime: ["PRIME-", "PRIME "],
      ProArt: ["PROART"],
      Phoenix: ["PHOENIX", "PH-"],
    },
  },
  MSI: {
    name: "MSI",
    keywords: ["MSI"],
    lines: {
      "Gaming X Trio": ["GAMING X TRIO", "GAMING-X-TRIO"],
      "Gaming Trio": ["GAMING TRIO", "GAMING-TRIO"],
      Suprim: ["SUPRIM"],
      Ventus: ["VENTUS"],
      "Gaming X": ["GAMING X", "GAMING-X"],
      Gaming: ["GAMING"],
      Mech: ["MECH"],
      Armor: ["ARMOR"],
      Aero: ["AERO"],
      Shadow: ["SHADOW"],
    },
  },
  GIGABYTE: {
    name: "Gigabyte",
    keywords: ["GIGABYTE", "GV-N", "GV-R"],
    lines: {
      Aorus: ["AORUS"],
      "Gaming OC": ["GAMING OC", "GAMINGOC"],
      Gaming: ["GAMING"],
      Eagle: ["EAGLE"],
      Windforce: ["WINDFORCE", "WF3", "WF2"],
      Vision: ["VISION"],
    },
  },
  ZOTAC: {
    name: "Zotac",
    keywords: ["ZOTAC", "ZT-"],
    lines: {
      "AMP Extreme": ["AMP EXTREME"],
      "AMP Infinity": ["AMP INFINITY"],
      AMP: ["AMP"],
      Trinity: ["TRINITY"],
      "Twin Edge": ["TWIN EDGE", "TWINEDGE"],
      Solid: ["SOLID"],
    },
  },
  EVGA: {
    name: "EVGA",
    keywords: ["EVGA"],
    lines: {
      FTW3: ["FTW3"],
      XC3: ["XC3"],
      XC: ["XC"],
    },
  },
  PNY: {
    name: "PNY",
    keywords: ["PNY", "VCNRTX", "VCG"],
    lines: {
      XLR8: ["XLR8"],
      Verto: ["VERTO"],
      "Dual Fan": ["DUAL FAN"],
      Quadro: ["QUADRO"],
    },
  },
  PALIT: {
    name: "Palit",
    keywords: ["PALIT"],
    lines: {
      GameRock: ["GAMEROCK"],
      JetStream: ["JETSTREAM"],
      "Dual OC": ["DUAL OC"],
    },
  },
  GAINWARD: {
    name: "Gainward",
    keywords: ["GAINWARD"],
    lines: {
      Phantom: ["PHANTOM"],
      Phoenix: ["PHOENIX"],
    },
  },
  SAPPHIRE: {
    name: "Sapphire",
    keywords: ["SAPPHIRE"],
    lines: {
      "Nitro+": ["NITRO+", "NITRO PLUS", "NITRO+"],
      Nitro: ["NITRO"],
      Pulse: ["PULSE"],
      Pure: ["PURE"],
    },
  },
  POWERCOLOR: {
    name: "PowerColor",
    keywords: ["POWERCOLOR", "POWER COLOR"],
    lines: {
      "Red Devil": ["RED DEVIL", "REDDEVIL"],
      Hellhound: ["HELLHOUND"],
      Fighter: ["FIGHTER"],
    },
  },
  XFX: {
    name: "XFX",
    keywords: ["XFX"],
    lines: {
      Speedster: ["SPEEDSTER"],
      Merc: ["MERC"],
      SWFT: ["SWFT"],
    },
  },
  ASROCK: {
    name: "ASRock",
    keywords: ["ASROCK"],
    lines: {
      Taichi: ["TAICHI"],
      Phantom: ["PHANTOM"],
      Challenger: ["CHALLENGER"],
    },
  },
  INNO3D: {
    name: "Inno3D",
    keywords: ["INNO3D"],
    lines: {
      iChill: ["ICHILL"],
      Twin: ["TWIN"],
    },
  },
  COLORFUL: {
    name: "Colorful",
    keywords: ["COLORFUL"],
    lines: {
      Vulcan: ["VULCAN"],
      Ultra: ["ULTRA"],
      NB: ["NB"],
    },
  },
  ONIX: {
    name: "Onix",
    keywords: ["ONIX"],
    lines: {
      Odyssey: ["ODYSSEY", "ODISSEY"],
    },
  },
};

/**
 * Extracts GPU brand and product line from title
 */
function extractGpuBrandLine(title: string, mpn?: string): BrandModel | null {
  const titleUpper = title.toUpperCase();
  const mpnUpper = mpn?.toUpperCase() || "";

  for (const [_key, brand] of Object.entries(GPU_BRANDS)) {
    // Check if brand matches in title or MPN
    const brandMatch = brand.keywords.some(
      (kw) => titleUpper.includes(kw) || mpnUpper.includes(kw),
    );

    if (brandMatch) {
      // Try to detect product line
      for (const [lineName, lineKeywords] of Object.entries(brand.lines)) {
        const lineMatch = lineKeywords.some(
          (kw) => titleUpper.includes(kw) || mpnUpper.includes(kw),
        );
        if (lineMatch) {
          return { brand: brand.name, model: lineName };
        }
      }
      // Brand found but no specific line detected
      return { brand: brand.name, model: "" };
    }
  }

  return null;
}

// ============================================================================
// VRAM & Variant Extraction
// ============================================================================

/**
 * Extracts VRAM amount from title
 */
function extractVram(title: string): string | null {
  // Match patterns like "32GB", "16 GB", "8G"
  const match = title.match(/(\d{1,2})\s*G(?:B)?(?:\s|D|$)/i);
  if (match) {
    return `${match[1]}GB`;
  }
  return null;
}

/**
 * Extracts OC/special variant info from title
 * @param title - Product title
 * @param productLine - Already detected product line (to avoid duplicating OC)
 */
function extractVariant(title: string, productLine?: string): string[] {
  const variants: string[] = [];
  const titleUpper = title.toUpperCase();
  const lineUpper = productLine?.toUpperCase() || "";

  // OC variants - only add if not already in product line name
  if (!lineUpper.includes("OC")) {
    if (titleUpper.includes(" OC ") || /\bOC\b/.test(titleUpper)) {
      variants.push("OC");
    }
  }

  // Special variants
  if (titleUpper.includes("WHITE") || titleUpper.includes("BLANCA")) {
    variants.push("White");
  }
  if (/\bICE\b/.test(titleUpper)) {
    variants.push("Ice");
  }
  if (titleUpper.includes("LOW PROFILE") || titleUpper.includes("LP")) {
    variants.push("Low Profile");
  }

  return variants;
}

// ============================================================================
// Main Normalizer Function
// ============================================================================

/**
 * Normalizes a GPU product title to a consistent format
 * @param title - Original product title
 * @param mpn - Product MPN (optional)
 * @param manufacturer - Manufacturer from specs (optional, used as fallback)
 * @returns Normalized title
 *
 * Examples:
 * - "TARJETA DE VIDEO GIGABYTE RTX 5060 TI EAGLE 8GB P/N GV-N5060TEAGLE OC-8GD"
 *   → "Gigabyte Eagle RTX 5060 Ti 8GB OC"
 *
 * - "TARJETA DE VIDEO ASUS DUAL GEFORCE RTX 5060 O8G GDDR7 OC EDITION"
 *   → "ASUS Dual RTX 5060 8GB OC"
 *
 * - "TARJETA DE VIDEO ZOTAC GEFORCE RTX 3060 TWIN EDGE 12GB GDDR6"
 *   → "Zotac Twin Edge RTX 3060 12GB"
 */
export function normalizeGpuTitle(title: string, mpn?: string, manufacturer?: string): string {
  // Clean HTML entities and extra spaces
  let cleanTitle = cleanHtmlEntities(title);

  // Remove Part Numbers (P/N)
  cleanTitle = cleanTitle
    .replace(/\s+P\/N\s*:?.*$/i, "") // Remove P/N at the end
    .replace(/\s+P\/N.*$/i, "") // Remove P/N anywhere if it's the last part
    .replace(/\s+P\/N\s+[A-Z0-9-]+/i, ""); // Remove P/N in the middle

  // Detect GPU chip
  const chip = detectGpuChip(cleanTitle);
  if (!chip) {
    // Can't detect GPU chip, return cleaned title (with P/N removed)
    // Also try to prepend manufacturer if missing and provided
    if (manufacturer) {
      const manuUpper = manufacturer.toUpperCase();
      if (!cleanTitle.toUpperCase().includes(manuUpper)) {
        // Capitalize first letter
        const properManu =
          manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1).toLowerCase();
        return `${properManu} ${cleanTitle}`;
      }
    }
    return cleanTitle;
  }

  // Detect brand and product line
  const brandLine = extractGpuBrandLine(cleanTitle, mpn);

  // Extract VRAM
  const vram = extractVram(cleanTitle);

  // Extract variants (OC, White, etc.) - pass product line to avoid duplicates
  const variants = extractVariant(cleanTitle, brandLine?.model);

  // Build normalized title
  const parts: string[] = [];

  // Brand
  if (brandLine?.brand) {
    parts.push(brandLine.brand);
  } else if (manufacturer) {
    // Fallback to manufacturer if brand not detected
    const manuUpper = manufacturer.toUpperCase();
    let properManu = manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1).toLowerCase();

    // Check if it's a known brand to get proper casing
    for (const brand of Object.values(GPU_BRANDS)) {
      if (brand.name.toUpperCase() === manuUpper) {
        properManu = brand.name;
        break;
      }
    }
    parts.push(properManu);
  }

  // Product line (e.g., "TUF", "Dual", "Eagle")
  if (brandLine?.model) {
    parts.push(brandLine.model);
  }

  // GPU model (e.g., "RTX 5060 Ti")
  let gpuModel = "";
  if (chip.manufacturer === "NVIDIA") {
    if (chip.series === "GT") {
      gpuModel = `GT ${chip.model}`;
    } else if (chip.series === "RTX A") {
      gpuModel = `RTX A${chip.model}`;
    } else {
      // RTX or GTX series
      const seriesPrefix = chip.series.startsWith("RTX") ? "RTX" : "GTX";
      gpuModel = `${seriesPrefix} ${chip.model}`;
      if (chip.variant) {
        // Format variant properly (Ti, Super)
        const formattedVariant =
          chip.variant === "TI"
            ? "Ti"
            : chip.variant.charAt(0) + chip.variant.slice(1).toLowerCase();
        gpuModel += ` ${formattedVariant}`;
      }
    }
  } else if (chip.manufacturer === "AMD") {
    gpuModel = `RX ${chip.model}`;
    if (chip.variant) {
      gpuModel += ` ${chip.variant}`;
    }
  } else if (chip.manufacturer === "Intel") {
    gpuModel = `Arc ${chip.model}`;
  }
  parts.push(gpuModel);

  // VRAM
  if (vram) {
    parts.push(vram);
  }

  // Variants (OC, White, etc.)
  for (const variant of variants) {
    if (!parts.includes(variant)) {
      parts.push(variant);
    }
  }

  return parts.join(" ");
}

// Export for direct access
export const GpuNormalizer = {
  normalize: normalizeGpuTitle,
  detectChip: detectGpuChip,
  extractBrandLine: extractGpuBrandLine,
  extractVram,
};
