/**
 * Normalizador de Títulos de HDD
 * Normaliza los títulos de discos duros a un formato consistente
 * Formato: "Marca Modelo Capacidad Tamaño RPM [Propósito]"
 * Ejemplo: "Seagate SkyHawk AI 8TB 3.5" 7200RPM"
 */

import type { BrandModel } from "./types";
import { cleanHtmlEntities, extractCapacity, extractRpm, extractSize } from "./utils";

/**
 * Detecta la línea de productos HDD de Western Digital desde el MPN
 * Patrones conocidos:
 * - WD*EZAZ, WD*EZEX, WD*EARZ = Blue (escritorio)
 * - WD*SPZX, WD*LPVX = Blue (móvil 2.5")
 * - WD*FZBX, WD*FZEX = Black
 * - WD*EFAX, WD*EFRX = Red (NAS)
 * - WD*EFPX = Red Plus (NAS)
 * - WD*FFBX = Red Pro (NAS)
 * - WD*PURZ, WD*PURX = Purple (Vigilancia)
 * - WD*EDAZ = Green
 * - WD*KRYZ, WD*FRYZ = Gold (Empresarial)
 */
function detectWdHddLineFromMpn(mpn: string): string | null {
  if (!mpn) return null;
  const mpnUpper = mpn.toUpperCase();

  // Blue Desktop - sufijos EZAZ, EZEX, EARZ
  if (mpnUpper.match(/WD\d+EZAZ/) || mpnUpper.match(/WD\d+EZEX/) || mpnUpper.match(/WD\d+EARZ/))
    return "Blue";

  // Blue Mobile - sufijos SPZX, LPVX
  if (mpnUpper.match(/WD\d+SPZX/) || mpnUpper.match(/WD\d+LPVX/)) return "Blue";

  // Black - sufijos FZBX, FZEX
  if (mpnUpper.match(/WD\d+FZBX/) || mpnUpper.match(/WD\d+FZEX/)) return "Black";

  // Red (NAS) - sufijos EFAX, EFRX
  if (mpnUpper.match(/WD\d+EFAX/) || mpnUpper.match(/WD\d+EFRX/)) return "Red";

  // Red Plus (NAS) - sufijo EFPX
  if (mpnUpper.match(/WD\d+EFPX/)) return "Red Plus";

  // Red Pro (NAS) - sufijo FFBX
  if (mpnUpper.match(/WD\d+FFBX/)) return "Red Pro";

  // Purple (Vigilancia) - sufijos PURZ, PURX
  if (mpnUpper.match(/WD\d+PURZ/) || mpnUpper.match(/WD\d+PURX/)) return "Purple";

  // Green - sufijo EDAZ
  if (mpnUpper.match(/WD\d+EDAZ/)) return "Green";

  // Gold (Empresarial) - sufijos KRYZ, FRYZ
  if (mpnUpper.match(/WD\d+KRYZ/) || mpnUpper.match(/WD\d+FRYZ/)) return "Gold";

  return null;
}

/**
 * Extrae y normaliza marca/modelo de HDD
 * @param title - Título del producto
 * @param mpn - MPN del producto (opcional)
 * @param manufacturer - Fabricante desde especificaciones/meta tags (opcional)
 */
function extractHddBrandModel(
  title: string,
  mpn?: string,
  manufacturer?: string,
): BrandModel | null {
  const titleUpper = title.toUpperCase();
  const mfrUpper = manufacturer?.toUpperCase() || "";

  // Western Digital
  if (
    titleUpper.includes("WD") ||
    titleUpper.includes("WESTERN DIGITAL") ||
    mfrUpper.includes("WESTERN DIGITAL")
  ) {
    // Primero intentar detectar por título
    if (titleUpper.includes("WD GOLD") || titleUpper.includes("GOLD")) {
      return { brand: "Western Digital", model: "Gold" };
    }
    if (titleUpper.includes("WD PURPLE PRO")) {
      return { brand: "Western Digital", model: "Purple Pro" };
    }
    if (titleUpper.includes("WD PURPLE")) {
      return { brand: "Western Digital", model: "Purple" };
    }
    if (titleUpper.includes("WD RED PLUS")) {
      return { brand: "Western Digital", model: "Red Plus" };
    }
    if (titleUpper.includes("WD RED PRO")) {
      return { brand: "Western Digital", model: "Red Pro" };
    }
    if (titleUpper.includes("WD RED")) {
      return { brand: "Western Digital", model: "Red" };
    }
    if (titleUpper.includes("WD BLUE")) {
      return { brand: "Western Digital", model: "Blue" };
    }
    if (titleUpper.includes("WD BLACK")) {
      return { brand: "Western Digital", model: "Black" };
    }
    if (titleUpper.includes("WD GREEN")) {
      return { brand: "Western Digital", model: "Green" };
    }

    // Si no se detecta por título, intentar por MPN
    const mpnLine = mpn ? detectWdHddLineFromMpn(mpn) : null;
    if (mpnLine) {
      return { brand: "Western Digital", model: mpnLine };
    }

    return { brand: "Western Digital", model: "" };
  }

  // Seagate
  if (titleUpper.includes("SEAGATE") || mfrUpper.includes("SEAGATE")) {
    if (titleUpper.includes("SKYHAWK AI")) {
      return { brand: "Seagate", model: "SkyHawk AI" };
    }
    if (titleUpper.includes("SKYHAWK")) {
      return { brand: "Seagate", model: "SkyHawk" };
    }
    if (titleUpper.includes("BARRACUDA")) {
      return { brand: "Seagate", model: "BarraCuda" };
    }
    if (titleUpper.includes("IRONWOLF PRO")) {
      return { brand: "Seagate", model: "IronWolf Pro" };
    }
    if (titleUpper.includes("IRONWOLF")) {
      return { brand: "Seagate", model: "IronWolf" };
    }
    if (titleUpper.includes("EXOS")) {
      return { brand: "Seagate", model: "Exos" };
    }
    if (titleUpper.includes("FIRECUDA")) {
      return { brand: "Seagate", model: "FireCuda" };
    }
    return { brand: "Seagate", model: "" };
  }

  // Toshiba
  if (titleUpper.includes("TOSHIBA")) {
    if (titleUpper.includes("P300")) {
      return { brand: "Toshiba", model: "P300" };
    }
    if (titleUpper.includes("X300")) {
      return { brand: "Toshiba", model: "X300" };
    }
    if (titleUpper.includes("N300")) {
      return { brand: "Toshiba", model: "N300" };
    }
    return { brand: "Toshiba", model: "" };
  }

  // Hitachi / HGST
  if (titleUpper.includes("HITACHI") || titleUpper.includes("HGST")) {
    if (titleUpper.includes("ULTRASTAR")) {
      return { brand: "Hitachi", model: "Ultrastar" };
    }
    if (titleUpper.includes("DESKSTAR")) {
      return { brand: "Hitachi", model: "Deskstar" };
    }
    return { brand: "Hitachi", model: "" };
  }

  // Ubiquiti
  if (titleUpper.includes("UBIQUITI")) {
    return { brand: "Ubiquiti", model: "" };
  }

  return null;
}

/**
 * Detecta el propósito/uso del HDD
 */
function extractHddPurpose(title: string): string | null {
  const titleUpper = title.toUpperCase();

  if (titleUpper.includes("VIDEOVIGILANCIA") || titleUpper.includes("SURVEILLANCE")) {
    return "Vigilancia";
  }
  if (titleUpper.includes("NAS")) {
    return "NAS";
  }
  if (titleUpper.includes("EMPRESARIAL") || titleUpper.includes("ENTERPRISE")) {
    return "Enterprise";
  }
  if (titleUpper.includes("SERVIDOR") || titleUpper.includes("SERVER")) {
    return "Server";
  }

  return null;
}

/**
 * Normaliza el título del HDD
 * Formato objetivo: "Marca Modelo Capacidad Tamaño RPM [Propósito]"
 * Ejemplo: "Seagate SkyHawk AI 8TB 3.5" 7200RPM"
 */
export function normalizeHddTitle(title: string, mpn?: string, manufacturer?: string): string {
  const cleaned = cleanHtmlEntities(title);

  const brandModel = extractHddBrandModel(cleaned, mpn, manufacturer);
  const capacity = extractCapacity(cleaned);
  const size = extractSize(cleaned);
  const rpm = extractRpm(cleaned);
  const purpose = extractHddPurpose(cleaned);

  // Si no podemos extraer información básica, devolver título limpio
  if (!brandModel && !capacity) {
    return cleaned;
  }

  const parts: string[] = [];

  // Marca y Modelo
  if (brandModel) {
    if (brandModel.model) {
      parts.push(`${brandModel.brand} ${brandModel.model}`);
    } else {
      parts.push(brandModel.brand);
    }
  }

  // Capacidad
  if (capacity) {
    parts.push(capacity);
  }

  // Tamaño
  if (size) {
    parts.push(size);
  }

  // RPM
  if (rpm) {
    parts.push(rpm);
  }

  // Propósito (si no es genérico)
  if (purpose && purpose !== "Enterprise") {
    parts.push(`(${purpose})`);
  }

  return parts.join(" ") || cleaned;
}
