import { describe, expect, test } from "bun:test";
import { familyKey } from "./family";

describe("familia de un producto (#101)", () => {
  test("mismo chip y memoria es la misma familia, sin importar marca, línea, OC ni color", () => {
    const asus = familyKey("gpu", { chipset: "rtx 5070", vram: 12, line: "dual", oc: true, color: "black" });
    expect(familyKey("gpu", { chipset: "rtx 5070", vram: 12, line: "ventus 2x", oc: false, color: "white" })).toBe(
      asus,
    );
    expect(familyKey("gpu", { chipset: "rtx 5070 ti", vram: 16, line: "dual" })).not.toBe(asus);
    expect(familyKey("gpu", { chipset: "rtx 5060 ti", vram: 8 })).not.toBe(
      familyKey("gpu", { chipset: "rtx 5060 ti", vram: 16 }),
    );
  });

  test("RAM: tipo, capacidad, kit y velocidad; la latencia y la línea no separan", () => {
    const base = { type: "ddr5", capacity: 32, modules: 2, speed: 6000, formFactor: "dimm" };
    const beast = familyKey("ram", { ...base, line: "beast", casLatency: 30, rgb: true });
    expect(familyKey("ram", { ...base, line: "vengeance", casLatency: 36 })).toBe(beast);
    expect(familyKey("ram", { ...base, modules: 1 })).not.toBe(beast);
  });

  test("sin un campo de la familia no hay familia", () => {
    expect(familyKey("gpu", { chipset: "rtx 5070" })).toBeNull();
    expect(familyKey("cpu", { model: "ryzen 5 5600x" })).toBeNull();
    expect(familyKey("case", { model: "h5 flow", formFactor: "mid tower" })).toBeNull();
    expect(familyKey("cpu_cooler", { type: "air", model: "ak620" })).toBeNull();
    expect(familyKey("cpu_cooler", { type: "aio", radiatorMm: 240 })).toBe("cpu_cooler|type=aio|radiatorMm=240");
  });
});
