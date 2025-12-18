/**
 * Normalizador de Títulos de RAM (Memoria)
 *
 * Normaliza los títulos de memoria RAM a un formato consistente.
 * Formato: "Marca Modelo Capacidad Tipo Velocidad Latencia"
 * Ejemplo: "Kingston Fury Beast 16GB DDR4 3200MHz CL16"
 *
 * ADVERTENCIA: Este código es horrible y necesita refactorización urgente.
 * TODO: Mejorar esta atrocidad de normalización cuando tengamos tiempo (nunca).
 */

import { cleanHtmlEntities } from "./utils";

/** Marcas de RAM reconocidas */

const BRANDS = [
  "Kingston",
  "Corsair",
  "ADATA",
  "XPG",
  "Crucial",
  "G.Skill",
  "TeamGroup",
  "Patriot",
  "Hiksemi",
  "Hikvision",
  "Samsung",
  "Geil",
  "HP",
  "Gigabyte",
  "Thermaltake",
  "Mushkin",
  "Pny",
  "Silicon Power",
  "Apacer",
  "Lexar",
  "Klevv",
];

const KNOWN_SERIES = [
  "Fury Beast",
  "Fury Renegade",
  "Renegade",
  "Vengeance LPX",
  "Vengeance RGB",
  "Vengeance",
  "Dominator Platinum",
  "Dominator",
  "Lancer Blade",
  "Lancer",
  "Spectrix D60G",
  "Spectrix D50",
  "Spectrix D41",
  "Spectrix D35G",
  "Spectrix D35",
  "Spectrix",
  "Gammix D35",
  "Gammix",
  "Trident Z",
  "TridentZ",
  "Ripjaws",
  "Aegis",
  "ValueRAM",
  "Signature",
  "Elite",
  "T-Force",
  "Delta",
  "Vulcan",
  "Zeus",
  "Dark",
  "Xtreem",
  "Viper",
  "Steel",
  "Venom",
  "U1",
  "U10",
  "S1",
  "Hiker",
  "Armor",
  "Future",
  "Pro",
  "Basics",
  "Basic",
  "Premier",
];

const JUNK_TERMS = [
  "Memoria",
  "RAM",
  "Kit de",
  "Kit",
  "Module",
  "Módulo",
  "Desktop",
  "Laptop",
  "Notebook",
  "PC",
  "DIMM",
  "UDIMM",
  "SODIMM",
  "SO-DIMM",
  "Unbuffered",
  "Non-ECC",
  "ECC",
  "Registered",
  "Buffered",
  "Single Rank",
  "Dual Rank",
  "Heatsink",
  "Bajo Perfil",
  "Low Profile",
  "Gaming",
  "Gamer",
  "Gamming",
  "Performance",
  "Black",
  "White",
  "Negro",
  "Blanco",
  "Silver",
  "Grey",
  "Red",
  "Blue",
  "RGB",
  "ARGB",
  "Caja Abierta",
  "Dañada",
  "Open Box",
  "OEM",
  "Box",
  "Para Servidor",
  "Server",
  "Compatible",
  "XMP",
  "EXPO",
  "AMD",
  "Intel",
  "Edition",
  "Series",
  "V",
  "Volts",
  "Volt",
  "CL",
  "CAS",
  "Latency",
  "Latencia",
  "Pin",
  "Pins",
  "Legacy",
  "SDRAM",
  "DDR",
  "DDR2",
  "DDR3",
  "DDR4",
  "DDR5",
  "MHZ",
  "MT/S",
  "HZ",
  "GB",
  "MB",
  "TB",
  "Con 3 0 Y",
  "3 0 Y",
  "1 35v",
  "D 1 35v",
];

const VOLTAGE_REGEX = /\b1\.\d+\s*V(?:olts?)?\b/gi;
const PN_REGEX = /P\/N\s*:?\s*[\w\-/]+/gi;

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => {
    // Acrónimos para mantener en mayúsculas
    if (/^(DDR\d|SDRAM|RGB|ARGB|CL\d+|PC\d+|XPG|HP|OC|LED|DIMM|UDIMM|SODIMM|CUDIMM)$/i.test(txt)) {
      return txt.toUpperCase();
    }
    // Unidades
    if (/^(MT\/s|MHz|GB|MB|TB)$/i.test(txt)) {
      if (txt.toLowerCase() === "mt/s") return "MT/s";
      if (txt.toLowerCase() === "mhz") return "MHz";
      return txt.toUpperCase();
    }
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

export function normalizeRamTitle(title: string, _mpn?: string | null, manufacturer?: string): string {
  let cleanTitle = cleanHtmlEntities(title);

  // Pre-limpieza de errores tipográficos
  cleanTitle = cleanTitle.replace(/(\d+)\s*HZ\b/gi, "$1 MHz");
  cleanTitle = cleanTitle.replace(/(\d+)\s*G\b/gi, "$1 GB"); // 8G -> 8GB
  cleanTitle = cleanTitle.replace(/\bDomintar\b/gi, "Dominator");
  cleanTitle = cleanTitle.replace(/\bDimmm\b/gi, "DIMM");
  cleanTitle = cleanTitle.replace(/\bCudimm\b/gi, "CUDIMM");
  cleanTitle = cleanTitle.replace(/\bBlanca\b/gi, "White");
  cleanTitle = cleanTitle.replace(/\bNegra\b/gi, "Black");
  cleanTitle = cleanTitle.replace(/\bKvr16ln11 8wp\b/gi, "KVR16LN11/8");
  cleanTitle = cleanTitle.replace(/\bSlabrbk\b/gi, "Blade Black");
  cleanTitle = cleanTitle.replace(/\bSlabrwh\b/gi, "Blade White");
  cleanTitle = cleanTitle.replace(/\bSlabbk\b/gi, "Blade Black");
  cleanTitle = cleanTitle.replace(/\bSlabwh\b/gi, "Blade White");
  cleanTitle = cleanTitle.replace(/\bClarbk\b/gi, "Lancer Black");
  cleanTitle = cleanTitle.replace(/\bDtlabrbk\b/gi, "Lancer Blade Black Kit");
  cleanTitle = cleanTitle.replace(/\bDtlabrwh\b/gi, "Lancer Blade White Kit");
  cleanTitle = cleanTitle.replace(/\bDtlabbk\b/gi, "Lancer Blade Black Kit");
  cleanTitle = cleanTitle.replace(/\bDtlabwh\b/gi, "Lancer Blade White Kit");
  cleanTitle = cleanTitle.replace(/\b2666ghz\b/gi, "2666 MHz");
  cleanTitle = cleanTitle.replace(/\b400 PC3200 512MB PC320\b/gi, "PC3200 512MB");
  cleanTitle = cleanTitle.replace(/\b266 PC2100 512MB PC210\b/gi, "PC2100 512MB");
  cleanTitle = cleanTitle.replace(/\b266 PC2100 1GB PC210\b/gi, "PC2100 1GB");
  cleanTitle = cleanTitle.replace(/\b2666 PC21300 8GB DDR4 PC213\b/gi, "PC4-21300 8GB DDR4");
  cleanTitle = cleanTitle.replace(/\b333 PC2700 512MB PC270\b/gi, "PC2700 512MB");
  cleanTitle = cleanTitle.replace(
    /Generic Of 4 Fury Beas 128GB DDR5 5200 MT\/s CL40/gi,
    "Kingston Fury Beast 128GB DDR5 5200 MT/s CL40",
  );

  // 1. Extraer Tipo
  let type = "";
  const ddrMatch = cleanTitle.match(/(?:DDR|LPDDR|GDDR)(\d)/i);
  if (ddrMatch) {
    type = ddrMatch[0].toUpperCase();
  } else if (/PC100|PC133|SDRAM/i.test(cleanTitle)) {
    type = "SDRAM";
  }

  // 2. Extraer Capacidad
  let capacity = "";
  const kitMatch = cleanTitle.match(/(\d+)\s*x\s*(\d+)\s*GB/i);
  if (kitMatch) {
    capacity = `Kit 2x${kitMatch[2]}GB`; // Estandarizar formato kit
  } else {
    const simpleCapMatch = cleanTitle.match(/(\d+)\s*GB/i);
    if (simpleCapMatch) {
      capacity = `${simpleCapMatch[1]}GB`;
    } else {
      const mbMatch = cleanTitle.match(/(\d+)\s*MB/i);
      if (mbMatch) capacity = `${mbMatch[1]}MB`;
    }
  }

  // 3. Extraer Velocidad
  let speed = "";
  // Prioridad a MT/s
  const mtsMatch = cleanTitle.match(/(\d{3,5})\s*(?:MT\/s|MHz)/i);
  if (mtsMatch) {
    speed = `${mtsMatch[1]} MT/s`;
  } else {
    // Verificar PCxxx
    const pcMatch = cleanTitle.match(/PC(\d{3})/i);
    if (pcMatch) {
      speed = `PC${pcMatch[1]}`; // ej. PC100
    }
  }

  // 4. Extraer Latencia
  let latency = "";
  // Intentar timing completo primero (ej. 16-18-18-38)
  const timingMatch = cleanTitle.match(/(\d{2}-\d{2}-\d{2}(?:-\d{2})?)/);
  if (timingMatch) {
    latency = `CL${timingMatch[1]}`;
  } else {
    const latencyMatch = cleanTitle.match(/\bC(?:L)?\s*[-:]?\s*(\d{2})\b/i);
    if (latencyMatch) {
      latency = `CL${latencyMatch[1]}`;
    }
  }

  // 5. Extraer Marca
  let brand = "";
  if (manufacturer) {
    const knownBrand = BRANDS.find((b) => b.toLowerCase() === manufacturer.toLowerCase());
    if (knownBrand) brand = knownBrand;
  }
  if (!brand) {
    // Encontrar la marca coincidente más larga en el título para evitar coincidencias parciales
    const matches = BRANDS.filter((b) => new RegExp(`\\b${b}\\b`, "i").test(cleanTitle));
    if (matches.length > 0) {
      brand = matches.sort((a, b) => b.length - a.length)[0];
    }
  }
  if (!brand) brand = "Generic";

  // 6. Limpiar Título para aislar Modelo
  let modelPart = cleanTitle;

  // Eliminar P/N
  modelPart = modelPart.replace(PN_REGEX, "");
  // Eliminar Voltaje
  modelPart = modelPart.replace(VOLTAGE_REGEX, "");

  // Eliminar Marca
  if (brand !== "Generic") {
    modelPart = modelPart.replace(new RegExp(`\\b${brand}\\b`, "gi"), "");
  }

  // Eliminar Tipo
  if (type) modelPart = modelPart.replace(new RegExp(`\\b${type}\\b`, "gi"), "");

  // Eliminar Capacidad (todas las ocurrencias)
  if (capacity) {
    // Eliminar patrones de kit
    modelPart = modelPart.replace(/(\d+)\s*x\s*(\d+)\s*GB/gi, "");
    // Eliminar patrones de capacidad simple
    modelPart = modelPart.replace(/(\d+)\s*GB/gi, "");
    modelPart = modelPart.replace(/(\d+)\s*MB/gi, "");
    modelPart = modelPart.replace(/\b\d+G\b/gi, "");
    // Eliminar números sobrantes que podrían ser capacidad (ej. "16 16GB" -> "16")
    const capNum = capacity.match(/\d+/)?.[0];
    if (capNum) {
      modelPart = modelPart.replace(new RegExp(`\\b${capNum}\\b`, "g"), "");
    }
  }

  // Eliminar Velocidad
  if (speed) {
    const speedVal = speed.split(" ")[0];
    if (speedVal.startsWith("PC")) {
      modelPart = modelPart.replace(new RegExp(`\\b${speedVal}\\b`, "gi"), "");
    } else {
      modelPart = modelPart.replace(new RegExp(`\\b${speedVal}\\s*(?:MT/s|MHz|HZ)\\b`, "gi"), "");
      modelPart = modelPart.replace(new RegExp(`\\b${speedVal}\\b`, "gi"), "");
    }
  }

  // Eliminar Latencia
  if (latency) {
    modelPart = modelPart.replace(/\bC(?:L)?\s*[-:]?\s*(\d{2})\b/gi, "");
    modelPart = modelPart.replace(/\b\d{2}-\d{2}-\d{2}(?:-\d{2})?\b/g, "");
  }

  // Eliminar Términos Basura
  JUNK_TERMS.forEach((term) => {
    modelPart = modelPart.replace(new RegExp(`\\b${term}\\b`, "gi"), "");
  });

  // Eliminar SKUs / Ruido (cadenas alfanuméricas largas)
  modelPart = modelPart.replace(/\b[A-Z0-9]{10,}\b/gi, "");

  // Limpiar puntuación y espacios
  modelPart = modelPart
    .replace(/[,.\-/()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Convertir modelo a Title Case
  let model = toTitleCase(modelPart);

  // Corregir capitalización o formato de series conocidas específicas
  KNOWN_SERIES.forEach((series) => {
    const regex = new RegExp(`\\b${series.replace(/\s+/g, "\\s*")}\\b`, "i");
    if (regex.test(model)) {
      model = model.replace(regex, series);
    }
  });

  // Corregir coincidencias parciales de series (ej. "Spectrix D" -> "Spectrix D50" si el contexto implica)
  // Esto es difícil sin contexto, pero podemos limpiar "Spectrix D" si está incompleto
  // Por ahora, confiamos en el orden de KNOWN_SERIES (más largo primero) para capturar modelos específicos

  // Si el modelo está vacío o es solo 1 caracter, ignorarlo
  if (model.length < 2) model = "";

  // Construir Título Final
  const parts = [brand, model, capacity, type, speed, latency].filter(Boolean);

  return parts.join(" ");
}
