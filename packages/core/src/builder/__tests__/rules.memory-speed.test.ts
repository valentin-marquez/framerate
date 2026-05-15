import { describe, expect, test } from "bun:test";
import { MemorySpeedRule } from "../index";
import { makeMobo, makeRam } from "./fixtures";

/**
 * Nota: el schema actual de Motherboard no tiene `memory.max_speed_mt_s`.
 * La regla está preparada para usarlo en cuanto se agregue al schema, y
 * mientras tanto siempre emite INSUFFICIENT_DATA. Estos tests usan un cast
 * para extender el spec en runtime y validar la lógica de comparación.
 */

type MoboMemoryWithMaxSpeed = {
  max_gb: number | null;
  type: string | null;
  slots: number | null;
  max_speed_mt_s?: number | null;
};

function moboWithMaxSpeed(maxSpeed: number | null) {
  const mobo = makeMobo();
  const memory: MoboMemoryWithMaxSpeed = {
    max_gb: 192,
    type: "DDR5",
    slots: 4,
    max_speed_mt_s: maxSpeed,
  };
  (mobo.specs as { memory: MoboMemoryWithMaxSpeed }).memory = memory;
  return mobo;
}

describe("MemorySpeedRule", () => {
  test("RAM 6000 MT/s con mobo max_speed 6400 => sin issues", () => {
    const issues = MemorySpeedRule.validate({
      ram: makeRam({ speed_mt_s: 6000 }),
      motherboard: moboWithMaxSpeed(6400),
    });
    expect(issues).toHaveLength(0);
  });

  test("RAM 8000 MT/s con mobo max_speed 6400 => warning MEMORY_SPEED_REQUIRES_OC", () => {
    const issues = MemorySpeedRule.validate({
      ram: makeRam({ speed_mt_s: 8000 }),
      motherboard: moboWithMaxSpeed(6400),
    });
    expect(issues.some((i) => i.code === "MEMORY_SPEED_REQUIRES_OC" && i.severity === "warning")).toBe(true);
  });

  test("ram.speed_mt_s null => INSUFFICIENT_DATA", () => {
    const issues = MemorySpeedRule.validate({
      ram: makeRam({ speed_mt_s: null }),
      motherboard: moboWithMaxSpeed(6400),
    });
    expect(issues.some((i) => i.code === "INSUFFICIENT_DATA")).toBe(true);
  });

  test("mobo sin max_speed_mt_s => INSUFFICIENT_DATA", () => {
    const issues = MemorySpeedRule.validate({
      ram: makeRam({ speed_mt_s: 6000 }),
      motherboard: makeMobo(), // schema actual no expone max_speed
    });
    expect(issues.some((i) => i.code === "INSUFFICIENT_DATA")).toBe(true);
  });
});
