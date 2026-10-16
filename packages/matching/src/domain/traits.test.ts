import { describe, expect, test } from "bun:test";
import type { Category } from "@framerate/contracts";
import cases from "./__fixtures__/traits-cases.json";
import { TRAIT_DISCRIMINATORS, titleTraits } from "./traits";

// Duplicados revisados a mano el 09-10 con títulos reales de las tiendas: `merged` son el mismo SKU, `separated` no.
const merged = cases.merged as { category: Category; titles: string[] }[];
const separated = cases.separated as { category: Category; a: string[]; b: string[] }[];

/** Lo que haría `compare`: veto si los dos títulos tienen el rasgo y difiere. */
const vetoes = (category: Category, a: string, b: string) => {
  const x = titleTraits(category, a);
  const y = titleTraits(category, b);
  return TRAIT_DISCRIMINATORS.filter((f) => x[f] !== undefined && y[f] !== undefined && x[f] !== y[f]);
};

describe("titleTraits", () => {
  test("ningún grupo fusionado se separa: ningún par de sus títulos se veta", () => {
    const split = merged.flatMap((g) =>
      g.titles.flatMap((a, i) =>
        g.titles.slice(i + 1).flatMap((b) => {
          const v = vetoes(g.category, a, b);
          return v.length ? [`${g.category} ${v.join(",")}: ${a} ## ${b}`] : [];
        }),
      ),
    );
    expect(split).toEqual([]);
  });

  test("separa los pares que difieren en pantalla, versión, edición, kit, LED o código de fuente", () => {
    const distinguished = separated.filter((p) => p.a.some((a) => p.b.some((b) => vetoes(p.category, a, b).length)));
    // Los demás: el rasgo ya tiene campo (OC, RGB, color, CL), o el título no alcanza (B760M-P sin DDR, AZZA sin modelo).
    expect(distinguished.length).toBeGreaterThanOrEqual(15);
  });

  test("casos puntuales", () => {
    expect(titleTraits("case", "Gabinete HYTE Y70 LCD 3ra Gen Pitch Black ATX")).toMatchObject({ screen: true });
    expect(titleTraits("case", "Gabinete HYTE Y70 Black ATX, Panorámico, No incluye LCD")).toMatchObject({
      screen: false,
    });
    expect(titleTraits("cpu_cooler", "Refrigeración Líquida NZXT Kraken Elite 240 RGB V2 White").traits).toBe("v2");
    expect(titleTraits("case_fan", "COOLER GAMEMAX GALEFORCE 32 LED BLUE 120MM").ledColor).toBe("blue");
    expect(titleTraits("cpu", "UPG 2do CPU Xeon-Silver 4410Y 12-core for HPE ML350 Gen11").oem).toBe("hpe");
    expect(titleTraits("psu", "FUENTE CERTIFICADA GAMEMAX 1000W 80+ GOLD - GZ1000G BK").psuCode).toBe("gz1000g");
    expect(titleTraits("psu", "Fuente de Poder Gamemax GZ-1000G 80PLUS GOLD 1000W").psuCode).toBe("gz1000g");
    expect(titleTraits("ssd", "SSD Western Digital Green SN350 1TB PCIe Gen3")).toEqual({ traits: "" });
  });

  test("Cybenetics sale del título de las fuentes y no veta", () => {
    const title = "Fuente Cooler Master 850W 80 Plus Gold Cybenetics Platinum LAMBDA A+";
    expect(titleTraits("psu", title)).toMatchObject({ eta: "platinum", lambda: "a+" });
    expect(titleTraits("psu", "Fuente 850W 80 Plus Gold")).not.toHaveProperty("eta");
    expect(titleTraits("gpu", "Tarjeta de video ETA Gold")).not.toHaveProperty("eta");
    // Una tienda que lo omite no separa el producto de la que lo dice.
    expect(vetoes("psu", title, "Fuente Cooler Master 850W 80 Plus Gold")).toEqual([]);
  });
});
