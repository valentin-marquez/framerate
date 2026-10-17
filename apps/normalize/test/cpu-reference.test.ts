import { describe, expect, test } from "bun:test";
import { canonicalModel, fromAmd, fromIntel } from "../scripts/cpu-reference";
import { type CpuReference, modelKey, modelNumber, withReference } from "../src/cpu-reference";

describe("nombres de las fichas", () => {
  test.each([
    ["AMD Ryzen™ 7 7800X3D", "ryzen 7 7800x3d"],
    ["AMD Ryzen™ 3 3200G with Radeon™ Vega 8 Graphics", "ryzen 3 3200g"],
    ["AMD Ryzen™ 5 5600GT (OEM Only)", "ryzen 5 5600gt"],
    ["7th Gen A10-9700 APU", "a10 9700"],
    ["Intel® Core™ i5-12400F ProcessorSpecifications", "core i5 12400f"],
    ["Intel® Core™ i5 processor 14400FSpecifications", "core i5 14400f"],
    ["Intel® Core™ Ultra 5 Processor 250K Plus", "core ultra 5 250k plus"],
    ["Intel® Xeon® Gold 5218R Processor", "xeon gold 5218r"],
  ])("%s", (name, model) => expect(canonicalModel(name)).toBe(model));

  test("el número es el último grupo de dígitos, aunque el modelo termine en Plus", () => {
    expect(modelNumber("core ultra 5 250k plus")).toBe("250");
    expect(modelNumber("ryzen 7 7800x3d")).toBe("7800");
    expect(modelNumber("core i5 12400f")).toBe("12400");
  });

  test("Haiku y la ficha pueden escribir el modelo distinto", () => {
    expect(modelKey("Ryzen 7 7800X3D")).toBe(modelKey("ryzen 7 7800x3d"));
    expect(modelKey("Xeon Silver 4416+")).toBe("xeonsilver4416+");
  });
});

describe("lectura de AMD e Intel", () => {
  const heads = [
    "Name",
    "# of CPU Cores",
    "# of Threads",
    "Max. Boost Clock",
    "Base Clock",
    "L3 Cache",
    "Default TDP",
    "CPU Socket",
    "Thermal Solution (PIB)",
    "System Memory Type",
    "System Memory Specification",
    "Graphics Model",
    "Product ID Boxed",
    "Product ID Tray",
  ];
  const amd = (over: Record<string, string>) =>
    heads.map(
      (h) =>
        ({
          Name: "AMD Ryzen™ 5 5600GT",
          "# of CPU Cores": "6",
          "# of Threads": "12",
          "Max. Boost Clock": "Up to 4.6 GHz",
          "Base Clock": "3.6 GHz",
          "L3 Cache": "16 MB",
          "Default TDP": "65W",
          "CPU Socket": "AM4",
          "Thermal Solution (PIB)": "AMD Wraith Stealth",
          "System Memory Type": "DDR4",
          "System Memory Specification": "Up to 3200 MT/s",
          "Graphics Model": "Radeon™ Graphics",
          "Product ID Boxed": "100-100001488BOX",
          "Product ID Tray": "100-000001488 (AM4)",
          ...over,
        })[h] ?? "",
    );

  test("AMD: specs, cooler de la caja y códigos de producto", () => {
    expect(fromAmd(heads, amd({}))).toMatchObject({
      model: "ryzen 5 5600gt",
      number: "5600",
      socket: "AM4",
      cores_total: 6,
      threads: 12,
      base_ghz: 3.6,
      boost_ghz: 4.6,
      l3_mb: 16,
      tdp_w: 65,
      integrated_graphics: "Radeon Graphics",
      boxed_cooler: "AMD Wraith Stealth",
      memory_types: "DDR4",
      memory_max_mt_s: 3200,
      part_numbers: ["100-100001488BOX", "100-000001488"],
    });
    expect(fromAmd(heads, amd({ "Thermal Solution (PIB)": "Not Included" }))?.boxed_cooler).toBe("");
    expect(fromAmd(heads, amd({ "Thermal Solution (PIB)": "" }))?.boxed_cooler).toBeNull();
    expect(
      fromAmd(heads, amd({ "Graphics Model": "Discrete Graphics Card Required" }))?.integrated_graphics,
    ).toBeNull();
  });

  test("AMD: los de notebook (soldados) no entran", () => {
    expect(fromAmd(heads, amd({ "CPU Socket": "FP8" }))).toBeNull();
  });

  test("Intel: socket sin FC, núcleos P y E, y todas las memorias", () => {
    const r = fromIntel("Intel® Core™ i5-12400F ProcessorSpecifications", "https://ark", {
      "Total Cores": "6",
      "# of Performance-cores": "6",
      "# of Efficient-cores": "0",
      "Total Threads": "12",
      "Max Turbo Frequency": "4.40 GHz",
      "Performance-core Base Frequency": "2.50 GHz",
      Cache: "18 MB Intel® Smart Cache",
      "Processor Base Power": "65 W",
      "Maximum Turbo Power": "117 W",
      "Memory Types": "Up to DDR5 4800 MT/s Up to DDR4 3200 MT/s",
      "Sockets Supported": "FCLGA1700",
    });
    expect(r).toMatchObject({
      model: "core i5 12400f",
      socket: "LGA1700",
      cores_performance: 6,
      cores_efficiency: 0,
      tdp_w: 65,
      max_power_w: 117,
      memory_types: "DDR4, DDR5",
      memory_max_mt_s: 4800,
      integrated_graphics: null,
      boxed_cooler: null,
    });
  });
});

describe("specs de referencia sobre las de Haiku", () => {
  const ref = { socket: "AM4", tdp_w: 65, cores_total: 6, boxed_cooler: "AMD Wraith Stealth" } as CpuReference;

  test("la ficha gana y queda marcada; lo que la ficha no tiene se mantiene", () => {
    const out = withReference(
      { socket: "LGA 1700", tdp_w: 95, l3_mb: 16 },
      { socket: "knowledge", tdp_w: "text", l3_mb: "text" },
      ref,
      "",
    );
    expect(out.specs).toMatchObject({ socket: "AM4", tdp_w: 65, l3_mb: 16 });
    expect(out.source).toMatchObject({ socket: "reference", tdp_w: "reference", l3_mb: "text" });
  });

  test.each([
    ["tray", false],
    ["box", true],
    ["box with cooler", true],
  ] as const)("cooler incluido según el empaque: %s", (packaging, included) => {
    expect(withReference({}, {}, ref, packaging).specs.includes_cooler).toBe(included);
  });

  test("una caja sin cooler según la ficha, o sin dato, no se inventa", () => {
    expect(withReference({}, {}, { ...ref, boxed_cooler: "" }, "box").specs.includes_cooler).toBe(false);
    expect(withReference({}, {}, { ...ref, boxed_cooler: null }, "box").specs.includes_cooler).toBeUndefined();
    expect(withReference({ includes_cooler: true }, { includes_cooler: "text" }, undefined, "box").specs).toEqual({
      includes_cooler: true,
    });
  });
});
