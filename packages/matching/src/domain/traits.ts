import type { Category } from "@framerate/contracts";
import { type Attributes, cyberneticsLevels, prep } from "./attributes";

/**
 * Rasgos que separan dos SKU con el mismo nombre de base y que la identidad no tiene en ningún campo: pantalla, versión,
 * edición, kit de un fabricante de servidores, color del LED, código de modelo de una fuente. Salen del título con una
 * lista fija, no de Haiku (que los reparte distinto en cada llamada). Medido sobre los duplicados revisados a mano el
 * 09-10 (`__fixtures__/traits-cases.json`): "RGB" en un gabinete, "SFF" o "R2.0" no entran, porque las tiendas los
 * omiten y separarían duplicados.
 */

type Rule = { categories?: readonly Category[]; trait: (t: string) => string | null };

const NOT = "(?<!(?:sin|no|no incluye|without|w o) )";
const word = (re: string, name: string, categories?: readonly Category[]): Rule => {
  const pattern = new RegExp(` ${NOT}(?:${re})(?= )`);
  return { categories, trait: (t) => (pattern.test(t) ? name : null) };
};

const LED_COLORS: Record<string, string> = {
  red: "red",
  rojo: "red",
  blue: "blue",
  azul: "blue",
  green: "green",
  verde: "green",
  white: "white",
  blanco: "white",
};

/** Rasgos que las tiendas escriben siempre que aplican: que no estén quiere decir que el producto no los tiene. */
const STRICT: Rule[] = [
  word("wood|madera", "wood", ["case"]),
  word("pro", "pro", ["case", "cpu_cooler", "case_fan"]),
  word("ice", "ice", ["gpu", "motherboard", "psu", "cpu_cooler"]),
  word("mlg", "mlg", ["gpu"]),
  word("evo", "evo", ["gpu"]),
  word("eco", "eco", ["psu"]),
  word("csm", "csm", ["motherboard"]),
  word("dark", "dark", ["motherboard"]),
  word("reverse", "reverse", ["case_fan"]),
  word("molex", "molex", ["case_fan"]),
  {
    // Versión del producto ("V2", "Gen2", "3rd Gen"); en SSD, placas y GPU "Gen4" es la versión de PCIe y no va.
    categories: ["cpu_cooler", "case", "case_fan", "psu"],
    trait: (t) => {
      // "ARGB Gen2" es el estándar de la iluminación, no la versión del producto.
      const m = t
        .replace(/ a?rgb gen ?\d/g, " ")
        .match(/ v ?([2-9])(?= )| gen ?([2-9])(?= )| ([2-9])(?:nd|rd|th) gen(?= )/);
      return m ? `v${m[1] ?? m[2] ?? m[3]}` : null;
    },
  },
  { categories: ["gpu"], trait: (t) => t.match(/ ocv([1-9])(?= )/)?.[0].trim() ?? null },
];

const applies = (category: Category, categories?: readonly Category[]) => !categories || categories.includes(category);

/**
 * Lo que el título dice y la identidad no tiene. `traits` siempre está ("" sin rasgos) y se compara estricto; los
 * demás sólo aparecen si el título los dice, porque las tiendas los omiten seguido (el Ryujin III Extreme siempre trae
 * pantalla y la mitad de los títulos no dice LCD): vetan cuando los dos lados los dicen y difieren.
 */
export function titleTraits(category: Category, title: string): Attributes {
  const t = prep(title);
  const strict = STRICT.filter((r) => applies(category, r.categories)).flatMap((r) => r.trait(t) ?? []);
  const a: Attributes = { traits: [...new Set(strict)].sort().join(" ") };

  if (category === "cpu_cooler" || category === "case") {
    const screen = /(?<= )(?:lcd|amoled|oled|display|pantalla|touch)(?= )/;
    if (/ (?:sin|no incluye|without) (?:pantalla |display )?(?:lcd|pantalla|display)(?= )/.test(t)) a.screen = false;
    else if (screen.test(t) || (category === "cpu_cooler" && / digital(?= )/.test(t))) a.screen = true;
  }
  if (category === "case_fan") {
    const c = t.match(/ led (red|rojo|blue|azul|green|verde|white|blanco)(?= )/)?.[1];
    const color = c && LED_COLORS[c];
    if (color) a.ledColor = color;
  }
  if (category === "cpu" || category === "hdd" || category === "ssd" || category === "ram") {
    // Procesadores, discos y memorias de servidor se venden en el kit de un fabricante y no se cruzan entre sí.
    const m = t.match(/ (hpe|proliant|lenovo|thinksystem|dell|poweredge)(?= )/)?.[1];
    if (m) a.oem = m === "proliant" ? "hpe" : m === "thinksystem" ? "lenovo" : m === "poweredge" ? "dell" : m;
  }
  if (category === "psu") {
    // Las fuentes no tienen campo de modelo: el código ("A850GN", "VTE500", "RM1000e") separa líneas de la misma
    // potencia. Se une aunque la tienda lo escriba con guion ("GZ-1000G").
    const noWatts = t.replace(/ \d{3,4} ?(?:w|watts?|wats)(?= )/g, " ");
    const codes = (noWatts.match(/ ([a-z]{1,4}) ?(\d{3,4}[a-z]{0,4})(?= )/g) ?? [])
      .map((s) => s.replace(/ /g, ""))
      .filter((c) => !/\d+w$/.test(c) && !/^(?:atx|pcie|de|gold|plus)/.test(c));
    if (codes[0]) a.psuCode = codes[0];
    // Informan (sellos de la web), no separan productos: no están en `TRAIT_DISCRIMINATORS`.
    Object.assign(a, cyberneticsLevels(title));
  }
  return a;
}

/** Discriminantes que agrega `titleTraits`; `compare` veta cuando los dos lados los tienen y difieren. */
export const TRAIT_DISCRIMINATORS = ["traits", "screen", "ledColor", "oem", "psuCode"] as const;
/** Rasgos del título que sólo informan: `compare` no los mira. */
export const TRAIT_INFO = ["eta", "lambda"] as const;
