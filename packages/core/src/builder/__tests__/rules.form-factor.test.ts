import { describe, expect, test } from "bun:test";
import { MotherboardFormFactorRule } from "../index";
import { makeCase, makeMobo } from "./fixtures";

describe("MotherboardFormFactorRule", () => {
  test("Micro ATX mobo + ATX/mATX/ITX case => sin issues", () => {
    const issues = MotherboardFormFactorRule.validate({
      motherboard: makeMobo({ form_factor: "Micro ATX" }),
      case: makeCase({ supported_motherboard_form_factors: ["ATX", "Micro ATX", "Mini ITX"] }),
    });
    expect(issues).toHaveLength(0);
  });

  test("E-ATX mobo en case que solo soporta mATX/ITX => MOTHERBOARD_FORM_FACTOR_MISMATCH", () => {
    const issues = MotherboardFormFactorRule.validate({
      motherboard: makeMobo({ form_factor: "E-ATX" }),
      case: makeCase({ supported_motherboard_form_factors: ["Micro ATX", "Mini ITX"] }),
    });
    expect(issues.some((i) => i.code === "MOTHERBOARD_FORM_FACTOR_MISMATCH" && i.severity === "error")).toBe(true);
  });

  test("normalización: 'micro-atx' vs 'Micro ATX' => sin issues", () => {
    const issues = MotherboardFormFactorRule.validate({
      motherboard: makeMobo({ form_factor: "Micro-ATX" }),
      case: makeCase({ supported_motherboard_form_factors: ["micro atx"] }),
    });
    expect(issues).toHaveLength(0);
  });

  test("supported_motherboard_form_factors null => INSUFFICIENT_DATA", () => {
    const issues = MotherboardFormFactorRule.validate({
      motherboard: makeMobo(),
      case: makeCase({ supported_motherboard_form_factors: null }),
    });
    expect(issues.some((i) => i.code === "INSUFFICIENT_DATA")).toBe(true);
  });
});
