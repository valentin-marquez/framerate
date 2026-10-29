import { describe, expect, test } from "bun:test";
import { NormalizationOutputSchema, outputSchema, SPEC_FIELDS } from "./normalization";

const output = (specs: Record<string, string>) => ({
  category: "mouse",
  category_reason: "",
  brand: "Logitech",
  name: "Logitech G305 Lightspeed",
  mpn: "",
  condition: "new",
  confidence: "high",
  identity: { model: "g305", wireless: "true", color: "" },
  identity_from_mpn: [],
  identity_from_knowledge: [],
  specs: { ...Object.fromEntries(SPEC_FIELDS.mouse.map((k) => [k, ""])), ...specs },
  specs_from_knowledge: [],
});

describe("specs cerradas", () => {
  test("el esquema de Haiku las pide como enum", () => {
    const specs = outputSchema("mouse").properties.specs.properties as Record<string, unknown>;
    expect(specs.connection).toEqual({ enum: ["wired", "2.4ghz", "bluetooth", "2.4ghz_bluetooth", ""] });
    expect(specs.sensor).toEqual({ type: "string" });
    expect(specs.grip).toEqual({ enum: ["palm", "claw", "fingertip", ""] });
  });

  test("descarta el texto libre y normaliza lo válido", () => {
    const parsed = NormalizationOutputSchema("mouse").parse(
      output({ wireless: "2.4GHz USB dongle", connection: "2.4GHz", sensor: "HERO 25K", max_dpi: "12000" }),
    );
    expect(parsed.specs.wireless).toBeNull();
    expect(parsed.specs.connection).toBe("2.4ghz");
    expect(parsed.specs.sensor).toBe("HERO 25K");
    expect(parsed.specs.max_dpi).toBe(12000);
  });

  test("el agarre de un mouse es de una lista", () => {
    const parse = (grip: string) => NormalizationOutputSchema("mouse").parse(output({ grip })).specs.grip;
    expect([parse("claw"), parse("hybrid claw-palm")]).toEqual(["claw", null]);
  });

  test("el tipo y el switch de un teclado son de una lista", () => {
    const keyboard = (specs: Record<string, string>) =>
      NormalizationOutputSchema("keyboard").parse({
        ...output({}),
        category: "keyboard",
        identity: { model: "k552", layout: "", wireless: "false", color: "" },
        specs: { ...Object.fromEntries(SPEC_FIELDS.keyboard.map((k) => [k, ""])), ...specs },
      });
    const valid = keyboard({ keyboard_type: "mechanical", switch_type: "brown" });
    expect([valid.specs.keyboard_type, valid.specs.switch_type]).toEqual(["mechanical", "brown"]);
    const free = keyboard({ keyboard_type: "optical", switch_type: "Redragon Red linear" });
    expect([free.specs.keyboard_type, free.specs.switch_type]).toEqual([null, null]);
  });
});
