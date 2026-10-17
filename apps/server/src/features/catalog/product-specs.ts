import { type Category, type ProductSpec, SPEC_FIELDS } from "@framerate/contracts";
import { parseJson } from "@framerate/database";

type SpecValue = ProductSpec["value"];

/**
 * Specs del producto desde las identidades de sus ofertas (#153, #106): por campo gana lo de la ficha oficial
 * (`reference`, #179); si no hay, el valor que más tiendas dicen; si ninguna lo dice, el que Haiku completó por
 * conocimiento, marcado. Se calcula al leer: una oferta nueva se refleja sola y no hay copia en `products` que mantener.
 */
export function fuseSpecs(category: Category, rows: { specs: string; specs_source: string }[]): ProductSpec[] {
  type Votes = { reference: Map<string, number>; text: Map<string, number>; knowledge: Map<string, number> };
  const votes = new Map<string, Votes>();
  for (const row of rows) {
    const specs = parseJson<Record<string, SpecValue | null>>(row.specs, {});
    const source = parseJson<Record<string, string>>(row.specs_source, {});
    for (const [key, value] of Object.entries(specs)) {
      if (value === null || value === "") continue;
      const field = votes.get(key) ?? { reference: new Map(), text: new Map(), knowledge: new Map() };
      const bucket =
        source[key] === "knowledge" ? field.knowledge : source[key] === "reference" ? field.reference : field.text;
      const k = JSON.stringify(value);
      bucket.set(k, (bucket.get(k) ?? 0) + 1);
      votes.set(key, field);
    }
  }
  const top = (bucket: Map<string, number>) =>
    [...bucket.entries()].reduce<[string, number] | null>((best, e) => (!best || e[1] > best[1] ? e : best), null);
  return SPEC_FIELDS[category].flatMap((key) => {
    const field = votes.get(key);
    if (!field) return [];
    const fromText = top(field.reference) ?? top(field.text);
    const winner = fromText ?? top(field.knowledge);
    if (!winner) return [];
    return [{ key, value: JSON.parse(winner[0]) as SpecValue, knowledge: !fromText }];
  });
}
