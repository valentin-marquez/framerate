import path from "node:path";
import { OpenDBClient } from "@framerate/opendb";
import logger from "@/logger";

// Map internal categories to OpenDB categories
const CATEGORY_MAP: Record<string, string> = {
  gpu: "GPU",
  cpu: "CPU",
  motherboard: "Motherboard",
  ram: "RAM",
  ssd: "Storage",
  hdd: "Storage",
  psu: "PSU",
  case: "PCCase",
  "cpu-cooler": "CPUCooler",
  "case-fan": "CaseFan",
  cpu_cooler: "CPUCooler",
  case_fan: "CaseFan",
};

function getBigrams(str: string): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.substring(i, i + 2));
  }
  return bigrams;
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/\s+/g, "");
  const s2 = str2.toLowerCase().replace(/\s+/g, "");

  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);

  let intersection = 0;
  for (const bg of bigrams1) {
    if (bigrams2.has(bg)) {
      intersection++;
    }
  }

  return (2 * intersection) / (bigrams1.size + bigrams2.size);
}

class OpenDBService {
  private client: OpenDBClient;
  private initialized = false;

  constructor() {
    this.client = new OpenDBClient({
      // Use a persistent path for the repo
      localPath: path.resolve(process.cwd(), "data/opendb"),
    });
  }

  async init() {
    if (this.initialized) return;
    try {
      logger.info("Initializing OpenDB...");
      await this.client.sync();
      this.initialized = true;
      logger.info("OpenDB initialized successfully.");
    } catch (error) {
      logger.error("Failed to initialize OpenDB:", error);
    }
  }

  getOpenDBCategory(internalCategory: string): string | undefined {
    // Try direct match or mapped match
    if (CATEGORY_MAP[internalCategory]) return CATEGORY_MAP[internalCategory];

    // Check if the internal category matches one of the OpenDB categories (case insensitive)
    try {
      const categories = this.client.getCategories();
      const match = categories.find((c) => c.toLowerCase() === internalCategory.toLowerCase());
      if (match) return match;
    } catch (_e) {
      // If getCategories fails (e.g. not synced), ignore
    }

    return undefined;
  }

  // biome-ignore lint/suspicious/noExplicitAny: datos opendb sin tipo
  findProduct(category: string, query: string): any | null {
    if (!this.initialized) {
      logger.warn("OpenDB not initialized, skipping search.");
      return null;
    }

    const openDBCategory = this.getOpenDBCategory(category);
    if (!openDBCategory) {
      logger.warn(`No OpenDB category found for: ${category}`);
      return null;
    }

    try {
      let items = this.client.getItems(openDBCategory);

      // Filter items based on internal category if needed
      if (openDBCategory === "Storage") {
        const lowerCat = category.toLowerCase();
        if (lowerCat === "ssd") {
          items = items.filter((item) => item.type === "SSD");
        } else if (lowerCat === "hdd") {
          items = items.filter((item) => item.type === "HDD");
        }
      }

      const lowerQuery = query.toLowerCase().trim();

      // 1. Search by MPN (Part Numbers)
      const mpnMatch = items.find((item) => {
        const partNumbers = item.metadata?.part_numbers;
        if (Array.isArray(partNumbers)) {
          return partNumbers.some((pn: string) => pn.toLowerCase() === lowerQuery);
        }
        return false;
      });

      if (mpnMatch) {
        return mpnMatch;
      }

      // 1.5. Search by Normalized prefix on MPN (alphanumeric only).
      // Tolera variaciones de espacios/guiones ("B850M D3HP" ↔ "B850M-D3HP"). NO acepta
      // un substring arbitrario (eso producía falsos positivos: query "B850" matcheaba
      // cualquier mobo con "B850" en cualquier parte). Sólo aceptamos prefix matches
      // bidireccionales: el query es prefijo del PN o el PN es prefijo del query.
      const normalizedQuery = lowerQuery.replace(/[^a-z0-9]/g, "");
      if (normalizedQuery.length > 4) {
        const mpnPrefixMatch = items.find((item) => {
          const partNumbers = item.metadata?.part_numbers;
          if (!Array.isArray(partNumbers)) return false;
          return partNumbers.some((pn: string) => {
            const normalizedPn = pn.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (normalizedPn.length < 4) return false;
            return (
              normalizedPn === normalizedQuery ||
              normalizedPn.startsWith(normalizedQuery) ||
              normalizedQuery.startsWith(normalizedPn)
            );
          });
        });

        if (mpnPrefixMatch) {
          return mpnPrefixMatch;
        }
      }

      // 2. Search by Similarity (MPN). Bigram similarity >= 0.95 AND a prefix relation
      // between the normalized forms — bigram alone matches B650/B850 too easily.
      // biome-ignore lint/suspicious/noExplicitAny: datos opendb sin tipo
      let bestMpnMatch: any = null;
      let maxMpnSimilarity = 0;

      for (const item of items) {
        const partNumbers = item.metadata?.part_numbers;
        if (Array.isArray(partNumbers)) {
          for (const pn of partNumbers) {
            const similarity = calculateSimilarity(query, pn);
            if (similarity > maxMpnSimilarity) {
              maxMpnSimilarity = similarity;
              bestMpnMatch = item;
            }
          }
        }
      }

      if (bestMpnMatch && maxMpnSimilarity >= 0.95) {
        // Extra guard: require normalized-prefix compatibility against at least one PN.
        const partNumbers: string[] = bestMpnMatch.metadata?.part_numbers ?? [];
        const compatible = partNumbers.some((pn: string) => {
          const nPn = pn.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (nPn.length < 4 || normalizedQuery.length < 4) return false;
          return nPn === normalizedQuery || nPn.startsWith(normalizedQuery) || normalizedQuery.startsWith(nPn);
        });
        if (compatible) {
          return bestMpnMatch;
        }
      }

      // 3. Search by Similarity (Name). Threshold 0.85 — antes 0.7 daba false-positives
      // entre productos cercanos (e.g., "Asus Prime B650" vs "Asus Prime B850").
      // biome-ignore lint/suspicious/noExplicitAny: datos opendb sin tipo
      let bestMatch: any = null;
      let maxSimilarity = 0;

      for (const item of items) {
        const name = item.metadata?.name || "";
        const similarity = calculateSimilarity(query, name);

        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          bestMatch = item;
        }
      }

      if (maxSimilarity >= 0.85) {
        return bestMatch;
      }

      return null;
    } catch (error) {
      logger.error(`Error searching OpenDB for ${category}/${query}:`, error);
      return null;
    }
  }
}

export const openDB = new OpenDBService();
