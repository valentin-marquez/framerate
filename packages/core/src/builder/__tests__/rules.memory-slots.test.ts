import { describe, expect, test } from "bun:test";
import { MemorySlotRule } from "../index";
import { makeMobo, makeRam } from "./fixtures";

describe("MemorySlotRule", () => {
  test("Kit de 2 módulos en mobo de 4 slots => sin issues", () => {
    const issues = MemorySlotRule.validate({
      ram: makeRam({ modules: { quantity: 2, capacity_gb: 16 } }),
      motherboard: makeMobo({ memory: { max_gb: 192, type: "DDR5", slots: 4 } }),
    });
    expect(issues).toHaveLength(0);
  });

  test("3 kits de 2 módulos en mobo de 4 slots => MEMORY_SLOTS_EXCEEDED", () => {
    const issues = MemorySlotRule.validate({
      ram: makeRam({ modules: { quantity: 2, capacity_gb: 16 } }, /* quantity */ 3),
      motherboard: makeMobo({ memory: { max_gb: 192, type: "DDR5", slots: 4 } }),
    });
    expect(issues.some((i) => i.code === "MEMORY_SLOTS_EXCEEDED" && i.severity === "error")).toBe(true);
  });

  test("mobo.memory.slots null => INSUFFICIENT_DATA", () => {
    const issues = MemorySlotRule.validate({
      ram: makeRam(),
      motherboard: makeMobo({ memory: { max_gb: 192, type: "DDR5", slots: null } }),
    });
    expect(issues.some((i) => i.code === "INSUFFICIENT_DATA")).toBe(true);
  });
});
