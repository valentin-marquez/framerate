import { describe, expect, test } from "bun:test";
import { MemoryTypeRule } from "../index";
import { makeMobo, makeRam } from "./fixtures";

describe("MemoryTypeRule", () => {
  test("DDR5 ram + DDR5 mobo => sin issues", () => {
    const issues = MemoryTypeRule.validate({
      ram: makeRam({ type: "DDR5" }),
      motherboard: makeMobo({ memory: { max_gb: 192, type: "DDR5", slots: 4 } }),
    });
    expect(issues).toHaveLength(0);
  });

  test("DDR4 ram + DDR5 mobo => MEMORY_TYPE_MISMATCH", () => {
    const issues = MemoryTypeRule.validate({
      ram: makeRam({ type: "DDR4" }),
      motherboard: makeMobo({ memory: { max_gb: 192, type: "DDR5", slots: 4 } }),
    });
    expect(issues.some((i) => i.code === "MEMORY_TYPE_MISMATCH" && i.severity === "error")).toBe(true);
  });

  test("ram.type null => INSUFFICIENT_DATA", () => {
    const issues = MemoryTypeRule.validate({
      ram: makeRam({ type: null }),
      motherboard: makeMobo(),
    });
    expect(issues.some((i) => i.code === "INSUFFICIENT_DATA")).toBe(true);
  });
});
