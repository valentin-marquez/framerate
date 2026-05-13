import type { CanonicalProduct } from "@framerate/opendb";
import { create, insert, type Orama, search } from "@orama/orama";
import jaroWinkler from "jaro-winkler";
import { Normalizer } from "./normalization";

export interface MatchResult {
  candidate: CanonicalProduct;
  score: number;
  confidence: "MATCH" | "AMBIGUOUS" | "NONE";
}

const ORAMA_PRODUCT_SCHEMA = {
  id: "string",
  manufacturer: "string",
  model: "string",
  series: "string",
  mpn: "string",
  title: "string", // synthesized title for search
} as const;

type OramaProductSchema = typeof ORAMA_PRODUCT_SCHEMA;

export class Matcher {
  private db: Orama<OramaProductSchema> | null = null;
  private products: Map<string, CanonicalProduct> = new Map();

  async load(products: CanonicalProduct[]) {
    this.db = await create({
      schema: ORAMA_PRODUCT_SCHEMA,
    });

    for (const p of products) {
      this.products.set(p.id || "", p);
      // Normalize values for the index
      const rawTitle = `${p.manufacturer} ${p.series || ""} ${p.model} ${p.mpn || ""}`;
      const normalizedTitle = Normalizer.normalize(rawTitle);

      await insert(this.db, {
        id: p.id || "",
        manufacturer: Normalizer.normalize(p.manufacturer),
        model: Normalizer.normalize(p.model),
        series: p.series ? Normalizer.normalize(p.series) : "",
        mpn: p.mpn ? p.mpn.toUpperCase() : "",
        title: normalizedTitle,
      });
    }
  }

  async search(query: string): Promise<MatchResult[]> {
    if (!this.db) throw new Error("Matcher not loaded");

    const normalizedQuery = Normalizer.normalize(query);
    const extractedMPN = Normalizer.extractMPN(query);

    // 1. Blocking / Retrieval via Orama
    const searchResult = await search(this.db, {
      term: normalizedQuery,
      limit: 20, // Top 20 candidates
      threshold: 0.3, // Fuzzy tolerance
    });

    const results: MatchResult[] = [];

    // 2. Scoring
    for (const hit of searchResult.hits) {
      const docId = String(hit.document.id);
      const candidate = this.products.get(docId);
      if (!candidate) continue;

      const score = this.calculateScore(normalizedQuery, extractedMPN, candidate);
      const confidence = this.getConfidence(score);

      results.push({ candidate, score, confidence });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private calculateScore(normalizedQuery: string, queryMPN: string | null, candidate: CanonicalProduct): number {
    // Exact MPN Match (High Confidence)
    if (candidate.mpn && queryMPN && candidate.mpn.toUpperCase() === queryMPN) {
      return 1.0;
    }
    // Partial MPN (if query contains the candidate's MPN)
    if (candidate.mpn && normalizedQuery.includes(candidate.mpn.toLowerCase())) {
      return 0.98;
    }

    // Jaro-Winkler on synthesized, normalized title
    const rawCandidateTitle = `${candidate.manufacturer} ${candidate.series || ""} ${candidate.model}`;
    const normalizedCandidateTitle = Normalizer.normalize(rawCandidateTitle);

    const jwScore = jaroWinkler(normalizedQuery, normalizedCandidateTitle);

    return jwScore;
  }

  private getConfidence(score: number): "MATCH" | "AMBIGUOUS" | "NONE" {
    if (score >= 0.95) return "MATCH";
    if (score >= 0.85) return "AMBIGUOUS";
    return "NONE";
  }
}
