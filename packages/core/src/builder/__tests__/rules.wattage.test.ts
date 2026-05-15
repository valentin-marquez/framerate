import { describe, expect, test } from "bun:test";
import { WattageRule } from "../index";
import { makeFullValidBuild, makePsu } from "./fixtures";

describe("WattageRule", () => {
  test("750W para build con RTX 5070 => sin issues", () => {
    const build = makeFullValidBuild();
    const issues = WattageRule.validate(build);
    expect(issues).toHaveLength(0);
  });

  test("PSU 300W para build con RTX 5070 => INSUFFICIENT_WATTAGE", () => {
    const build = makeFullValidBuild();
    build.psu = makePsu({ wattage: 300 });
    const issues = WattageRule.validate(build);
    expect(issues.some((i) => i.code === "INSUFFICIENT_WATTAGE" && i.severity === "error")).toBe(true);
  });

  test("PSU sin wattage => INSUFFICIENT_DATA (info)", () => {
    const build = makeFullValidBuild();
    build.psu = makePsu({ wattage: null });
    const issues = WattageRule.validate(build);
    expect(issues.some((i) => i.code === "INSUFFICIENT_DATA" && i.severity === "info")).toBe(true);
  });
});
