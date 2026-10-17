import { describe, expect, test } from "bun:test";
import { fuseSpecs } from "@/features/catalog/product-specs";

const row = (specs: Record<string, unknown>, source: Record<string, string> = {}) => ({
  specs: JSON.stringify(specs),
  specs_source: JSON.stringify(source),
});

describe("fuseSpecs", () => {
  test("gana lo que dicen más tiendas; lo de conocimiento sólo si ninguna lo dice, y marcado", () => {
    const specs = fuseSpecs("cpu", [
      row({ socket: "LGA1700", tdp_w: 125, threads: 16 }, { socket: "text", tdp_w: "text", threads: "knowledge" }),
      row({ socket: "LGA1700", tdp_w: 65 }, { socket: "text", tdp_w: "text" }),
      row({ socket: "AM5", tdp_w: 125 }, { socket: "text", tdp_w: "knowledge" }),
    ]);
    expect(specs).toEqual([
      { key: "socket", value: "LGA1700", knowledge: false },
      { key: "threads", value: 16, knowledge: true },
      { key: "tdp_w", value: 125, knowledge: false },
    ]);
  });

  test("lo de la ficha oficial gana aunque más tiendas digan otra cosa (#179)", () => {
    const specs = fuseSpecs("cpu", [
      row({ socket: "LGA 1700", tdp_w: 125 }, { socket: "text", tdp_w: "text" }),
      row({ socket: "LGA 1700", tdp_w: 125 }, { socket: "text", tdp_w: "text" }),
      row({ socket: "LGA1700", tdp_w: 65 }, { socket: "reference", tdp_w: "reference" }),
    ]);
    expect(specs).toEqual([
      { key: "socket", value: "LGA1700", knowledge: false },
      { key: "tdp_w", value: 65, knowledge: false },
    ]);
  });

  test("ignora campos de otra categoría y valores vacíos", () => {
    expect(fuseSpecs("gpu", [row({ socket: "AM5", memory_type: "" }), row({ tdp_w: 220 })])).toEqual([
      { key: "tdp_w", value: 220, knowledge: false },
    ]);
  });
});
