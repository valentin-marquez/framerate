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

      // 1.5. Search by Contains MPN (Normalized)
      // Some OpenDB entries have the model name mixed with the MPN or have different spacing
      if (lowerQuery.length > 3) {
        // Standard contains check
        const mpnContainsMatch = items.find((item) => {
          const partNumbers = item.metadata?.part_numbers;
          if (Array.isArray(partNumbers)) {
            return partNumbers.some((pn: string) => pn.toLowerCase().includes(lowerQuery));
          }
          return false;
        });

        if (mpnContainsMatch) {
          return mpnContainsMatch;
        }

        // Normalized check (remove non-alphanumeric chars)
        const normalizedQuery = lowerQuery.replace(/[^a-z0-9]/g, "");
        if (normalizedQuery.length > 3) {
          const mpnNormalizedMatch = items.find((item) => {
            const partNumbers = item.metadata?.part_numbers;
            if (Array.isArray(partNumbers)) {
              return partNumbers.some((pn: string) => {
                const normalizedPn = pn.toLowerCase().replace(/[^a-z0-9]/g, "");
                return normalizedPn.includes(normalizedQuery);
              });
            }
            return false;
          });

          if (mpnNormalizedMatch) {
            return mpnNormalizedMatch;
          }
        }
      }

      // 2. Search by Similarity (MPN)
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

      if (maxMpnSimilarity >= 0.8) {
        return bestMpnMatch;
      }

      // 3. Search by Similarity (Name)
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

      if (maxSimilarity >= 0.7) {
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
