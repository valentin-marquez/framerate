import { expect, test } from "bun:test";
import type { Category } from "@framerate/contracts";
import { decide } from "@framerate/matching";
import gold from "./match-gold.json";
import { normalizeOffer } from "./normalize";

type Pair = (typeof gold)[number];

// Cada lado sigue el camino de una oferta real (limpieza del título, cuarentena, huella).
function fingerprint(category: Category, side: Pair["a"]) {
  const result = normalizeOffer(
    {
      externalId: "gold",
      url: "https://example.cl/gold",
      title: side.rawTitle,
      category,
      priceCash: 100_000,
      priceCard: null,
      inStock: true,
      stockQuantity: null,
      brand: side.brand,
      mpn: side.mpn,
      gtin: side.gtin,
      imageUrls: [],
    },
    category,
  );
  return result.ok ? result.offer.fingerprint : null;
}

function outcome(pair: Pair) {
  const category = pair.category as Category;
  const a = fingerprint(category, pair.a);
  const b = fingerprint(category, pair.b);
  if (!a || !b) return "quarantine";
  return decide(a, [{ productId: 1, fingerprint: b, sameStore: pair.a.store === pair.b.store }]).kind;
}

// Los topes sólo se mueven en la buena dirección, en el mismo commit que mejora el matching.
const MAX_WRONG_MERGES = 3;
const MIN_SAME_LINKED = 110;

test("set etiquetado: fusiones erróneas (precisión) y vínculos correctos (recall)", () => {
  const sure = gold.filter((p) => p.confidence === "high");
  const wrong = sure.filter((p) => p.label === "different" && outcome(p) === "link");
  const same = sure.filter((p) => p.label === "same");
  const linked = same.filter((p) => outcome(p) === "link").length;
  console.log(`fusiones erróneas ${wrong.length}  recall ${linked}/${same.length}`);
  for (const p of wrong) console.log(`  ${p.category}: ${p.a.rawTitle} <> ${p.b.rawTitle}`);
  expect(wrong.length).toBeLessThanOrEqual(MAX_WRONG_MERGES);
  expect(linked).toBeGreaterThanOrEqual(MIN_SAME_LINKED);
});
