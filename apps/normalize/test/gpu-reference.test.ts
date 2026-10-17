import { describe, expect, test } from "bun:test";
import { canonicalChipset, fromAmd, fromNvidia } from "../scripts/gpu-reference";
import { chipsetNumber, fillFromGpuReference, type GpuReference, pickGpuReference } from "../src/gpu-reference";

describe("chipsets", () => {
  test.each([
    ["AMD Radeon™ RX 9070 XT", "rx 9070 xt"],
    ["AMDRadeonRX7600XT", "rx 7600 xt"],
    ["GeForce RTX 5070 Ti", "rtx 5070 ti"],
    ["GeForce RTX 4070 Ti SUPER", "rtx 4070 ti super"],
    ["GeForce RTX 3050 (8 GB)", "rtx 3050 8gb"],
  ])("%s", (name, chipset) => expect(canonicalChipset(name)).toBe(chipset));

  test("el número para buscar por título ignora la memoria de la variante", () => {
    expect(chipsetNumber("rtx 3050 8gb")).toBe("3050");
    expect(chipsetNumber("arc b580")).toBe("580");
  });

  test("la variante de memoria gana sobre el chipset solo", () => {
    const refs = [
      { chipset: "rtx 3050", board_power_w: 130 },
      { chipset: "rtx 3050 6gb", board_power_w: 70 },
    ] as GpuReference[];
    expect(pickGpuReference(refs, "RTX 3050", 6)?.board_power_w).toBe(70);
    expect(pickGpuReference(refs, "rtx 3050", 8)?.board_power_w).toBe(130);
    expect(pickGpuReference(refs, "rtx 4060", 8)).toBeUndefined();
  });
});

describe("fuentes", () => {
  test("AMD: consumo, fuente mínima, memoria y arquitectura por serie; los de notebook no entran", () => {
    const specs = {
      "Board Type": ["Desktop"],
      "Typical Board Power (Desktop)": "304W",
      "Minimum PSU Recommendation": "750",
      "Additional Power Connector": ["2x8-Pin"],
      "Memory Type": ["GDDR6"],
      "Max Memory Size": "16",
      "Memory Interface": "256_bit",
      "Bus Type": ["PCIe® 5.0 x16"],
      "Stream Processors": ["4096"],
    };
    expect(fromAmd("AMD Radeon™ RX 9070 XT", specs)).toMatchObject({
      chipset: "rx 9070 xt",
      number: "9070",
      architecture: "RDNA 4",
      board_power_w: 304,
      min_psu_w: 750,
      memory_type: "GDDR6",
      vram_gb: [16],
      memory_bus_bit: 256,
      pcie_version: "5.0",
      shader_cores: 4096,
    });
    expect(fromAmd("AMD Radeon™ RX 7600M", { ...specs, "Board Type": ["Notebook"] })).toBeNull();
  });

  test("NVIDIA: una columna por modelo y una fila por variante de memoria con su consumo", () => {
    const html = `<table>
      <tr><td></td><td></td><td>GeForce RTX 3080 Ti</td><td>GeForce RTX 3080</td></tr>
      <tr><td>Memory Specs:</td><td>Standard Memory Config</td><td>12 GB GDDR6X</td><td>12 GB GDDR6X / 10 GB GDDR6X</td></tr>
      <tr><td></td><td>NVIDIA Architecture</td><td>Ampere</td><td>Ampere</td></tr>
      <tr><td></td><td>Length</td><td>11.2" (285 mm)</td><td>11.2" (285 mm)</td></tr>
      <tr><td></td><td>Graphics Card Power (W)</td><td>350</td><td>350 / 320</td></tr>
      <tr><td></td><td>Required System Power (W)</td><td>750</td><td>750</td></tr>
    </table>`;
    const rows = fromNvidia(html, "https://nvidia/30-series/rtx-3080-3080ti/");
    expect(rows.map((r) => [r.chipset, r.board_power_w, r.vram_gb])).toEqual([
      ["rtx 3080 ti", 350, [12]],
      ["rtx 3080", 350, [12, 10]],
      ["rtx 3080 12gb", 350, [12]],
      ["rtx 3080 10gb", 320, [10]],
    ]);
    expect(rows[0]).toMatchObject({
      architecture: "Ampere",
      min_psu_w: 750,
      memory_type: "GDDR6X",
      reference_length_mm: 285,
    });
  });

  test("NVIDIA: en la página de un modelo el nombre sale de la URL, no de una columna de comparación", () => {
    const html = `<table>
      <tr><td></td><td></td><td>GeForce RTX 4090</td></tr>
      <tr><td></td><td>Total Graphics Power (W)</td><td>360</td></tr>
    </table>`;
    expect(fromNvidia(html, "https://nvidia/50-series/rtx-5080/").map((r) => r.chipset)).toEqual(["rtx 5080"]);
  });
});

describe("relleno", () => {
  const ref = { board_power_w: 300, memory_type: "GDDR7", min_psu_w: 750, architecture: "Blackwell" } as GpuReference;

  test("completa lo que falta y lo que Haiku puso de memoria, nunca lo que dice la tienda", () => {
    const out = fillFromGpuReference(
      { tdp_w: 340, memory_type: "GDDR6" },
      { tdp_w: "text", memory_type: "knowledge" },
      ref,
    );
    expect(out.specs).toEqual({ tdp_w: 340, memory_type: "GDDR7", min_psu_w: 750, architecture: "Blackwell" });
    expect(out.source).toEqual({
      tdp_w: "text",
      memory_type: "reference",
      min_psu_w: "reference",
      architecture: "reference",
    });
  });
});
