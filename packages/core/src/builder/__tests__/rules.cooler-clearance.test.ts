import { describe, expect, test } from "bun:test";
import { CoolerClearanceRule } from "../index";
import { makeAioCooler, makeAirCooler, makeCase } from "./fixtures";

describe("CoolerClearanceRule", () => {
  test("Air cooler 165mm en case con max 170mm => sin issues", () => {
    const issues = CoolerClearanceRule.validate({
      "cpu-cooler": makeAirCooler({ height_mm: 165 }),
      case: makeCase({ max_cpu_cooler_height_mm: 170 }),
    });
    expect(issues).toHaveLength(0);
  });

  test("Air cooler 170mm en case con max 155mm => COOLER_TOO_TALL", () => {
    const issues = CoolerClearanceRule.validate({
      "cpu-cooler": makeAirCooler({ height_mm: 170 }),
      case: makeCase({ max_cpu_cooler_height_mm: 155 }),
    });
    expect(issues.some((i) => i.code === "COOLER_TOO_TALL" && i.severity === "error")).toBe(true);
  });

  test("AIO cooler => no se valida altura", () => {
    const issues = CoolerClearanceRule.validate({
      "cpu-cooler": makeAioCooler(),
      case: makeCase({ max_cpu_cooler_height_mm: 50 }),
    });
    expect(issues).toHaveLength(0);
  });

  test("Air cooler sin height_mm => INSUFFICIENT_DATA", () => {
    const issues = CoolerClearanceRule.validate({
      "cpu-cooler": makeAirCooler({ height_mm: null }),
      case: makeCase(),
    });
    expect(issues.some((i) => i.code === "INSUFFICIENT_DATA")).toBe(true);
  });
});
