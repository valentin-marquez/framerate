import { describe, expect, test } from "bun:test";
import { flattenSpecs, SPEC_SCHEMAS } from "./specs";

describe("specs", () => {
  test("aplana anidados, arrays y booleanos; omite null", () => {
    const facets = flattenSpecs({
      socket: "am5",
      cores: { total: 8, threads: 16, efficiency: null },
      memory_types: ["ddr5", "ddr5"],
      includes_cooler: false,
      pcie_slots: [
        { gen: 5, lanes: 16, quantity: 1 },
        { gen: 4, lanes: 4, quantity: 2 },
      ],
      integrated_graphics: null,
    });
    expect(facets).toEqual([
      { key: "socket", valueText: "am5", valueNum: null },
      { key: "cores.total", valueText: null, valueNum: 8 },
      { key: "cores.threads", valueText: null, valueNum: 16 },
      { key: "memory_types", valueText: "ddr5", valueNum: null },
      { key: "includes_cooler", valueText: null, valueNum: 0 },
      { key: "pcie_slots.count", valueText: null, valueNum: 2 },
    ]);
  });

  test("rechaza valores centinela y enums fuera de catálogo", () => {
    expect(SPEC_SCHEMAS.psu.safeParse({ efficiency_rating: "80+ Gold" }).success).toBe(false);
    expect(SPEC_SCHEMAS.psu.safeParse({ efficiency_rating: "gold", wattage: 850 }).success).toBe(true);
    expect(SPEC_SCHEMAS.gpu.safeParse({ memory_gb: -8 }).success).toBe(false);
    expect(SPEC_SCHEMAS.case.safeParse({ supported_motherboard_form_factors: ["atx", "Desconocido"] }).success).toBe(
      false,
    );
  });
});
