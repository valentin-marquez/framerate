import type { Category, IdentitySource } from "@framerate/contracts";
import {
  type AnchorResult,
  buildFingerprint,
  type Decision,
  decide,
  type Fingerprint,
  fingerprintFromIdentity,
  listingIdentityFrom,
} from "@framerate/matching";

// Lo que comparten el script que normaliza el gold y el test que lo mide (#153, fase 0).

export type GoldSide = {
  store: string;
  rawTitle: string;
  brand: string | null;
  mpn: string | null;
  gtin: string | null;
};
export type GoldPair = {
  source: string;
  category: string;
  label: string;
  confidence: string;
  note: string;
  a: GoldSide;
  b: GoldSide;
};

/** Un lado del gold normalizado (test/gold-normalized.json): único por categoría y datos de la tienda. */
export interface NormalizedSide {
  category: Category;
  rawTitle: string;
  brand: string | null;
  mpn: string | null;
  gtin: string | null;
  status: "ok" | "invalid" | "refusal";
  out: IdentitySource | null;
}

export const sideKey = (category: string, s: Pick<GoldSide, "rawTitle" | "brand" | "mpn" | "gtin">) =>
  [category, s.rawTitle, s.brand, s.mpn, s.gtin].join("|");

export function identityFingerprint(side: NormalizedSide): {
  fingerprint: Fingerprint | null;
  anchored: AnchorResult | null;
} {
  if (!side.out) return { fingerprint: null, anchored: null };
  const { identity, anchored } = listingIdentityFrom(side.out, {
    category: side.category,
    title: side.rawTitle,
    brand: side.brand,
    mpn: side.mpn,
  });
  return {
    fingerprint: identity ? fingerprintFromIdentity({ identity, mpn: side.mpn, gtin: side.gtin }) : null,
    anchored,
  };
}

export const regexFingerprint = (category: Category, s: GoldSide) =>
  buildFingerprint({ category, title: s.rawTitle, brand: s.brand, mpn: s.mpn, gtin: s.gtin });

export function outcome(a: Fingerprint | null, b: Fingerprint | null, sameStore: boolean): Decision | "missing" {
  if (!a || !b) return "missing";
  return decide(a, [{ productId: 1, fingerprint: b, sameStore }]);
}
