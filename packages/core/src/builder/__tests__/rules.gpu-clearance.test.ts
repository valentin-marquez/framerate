import { describe, expect, test } from "bun:test";
import { GpuClearanceRule } from "../index";
import { makeCase, makeGpu } from "./fixtures";

describe("GpuClearanceRule", () => {
  test("GPU 304mm en case con max 400mm => sin issues", () => {
    const issues = GpuClearanceRule.validate({
      gpu: makeGpu({ length_mm: 304 }),
      case: makeCase({ max_gpu_length_mm: 400 }),
    });
    expect(issues).toHaveLength(0);
  });

  test("GPU 350mm en case con max 320mm => GPU_TOO_LONG", () => {
    const issues = GpuClearanceRule.validate({
      gpu: makeGpu({ length_mm: 350 }),
      case: makeCase({ max_gpu_length_mm: 320 }),
    });
    expect(issues.some((i) => i.code === "GPU_TOO_LONG" && i.severity === "error")).toBe(true);
  });

  test("GPU sin length_mm => INSUFFICIENT_DATA (en vez de silencio)", () => {
    const issues = GpuClearanceRule.validate({
      gpu: makeGpu({ length_mm: null }),
      case: makeCase(),
    });
    expect(issues.some((i) => i.code === "INSUFFICIENT_DATA")).toBe(true);
  });
});
