import { describe, expect, test } from "bun:test";
import { reconcileGpuTitle } from "../product.pipeline";

describe("reconcileGpuTitle", () => {
  test("match: title GB equals specs.memory_gb -> no change", () => {
    const result = reconcileGpuTitle("ASUS Dual RTX 5070 12GB OC", { memory_gb: 12 });
    expect(result.corrected).toBe(false);
    expect(result.title).toBe("ASUS Dual RTX 5070 12GB OC");
    expect(result.titleGb).toBe(12);
    expect(result.specsGb).toBe(12);
  });

  test("mismatch (real bug): title 70GB vs specs 12 -> corrected to 12GB", () => {
    const result = reconcileGpuTitle("ASUS Dual RTX 5070 70GB OC", { memory_gb: 12 });
    expect(result.corrected).toBe(true);
    expect(result.title).toBe("ASUS Dual RTX 5070 12GB OC");
    expect(result.titleGb).toBe(70);
    expect(result.specsGb).toBe(12);
  });

  test("specs missing memory_gb -> no change", () => {
    const result = reconcileGpuTitle("ASUS Dual RTX 5070 12GB OC", {});
    expect(result.corrected).toBe(false);
    expect(result.title).toBe("ASUS Dual RTX 5070 12GB OC");
  });

  test("specs is null -> no change", () => {
    const result = reconcileGpuTitle("ASUS Dual RTX 5070 12GB OC", null);
    expect(result.corrected).toBe(false);
    expect(result.title).toBe("ASUS Dual RTX 5070 12GB OC");
  });

  test("title without GB token -> no change (we don't inject new GB tokens; bracketed MPN suffixes legitimately omit them)", () => {
    const result = reconcileGpuTitle("ASUS Dual RTX 5070 OC", { memory_gb: 12 });
    expect(result.corrected).toBe(false);
    expect(result.title).toBe("ASUS Dual RTX 5070 OC");
  });

  test("title with [MPN] suffix containing O12G digits -> only the wrong 70GB body token is replaced; bracket preserved verbatim", () => {
    const result = reconcileGpuTitle("ASUS Dual RTX 5070 70GB OC [DUAL-RTX5070-O12G]", { memory_gb: 12 });
    expect(result.corrected).toBe(true);
    expect(result.title).toBe("ASUS Dual RTX 5070 12GB OC [DUAL-RTX5070-O12G]");
    expect(result.titleGb).toBe(70);
    expect(result.specsGb).toBe(12);
  });

  test("multiple GB tokens -> the one closest to end (excluding bracket) is reconciled", () => {
    // Some retailers awkwardly stack two GB tokens; AIB convention places the
    // real VRAM right before the suffix. Reconcile the trailing one.
    const result = reconcileGpuTitle("Foo 8GB Edition RTX 5070 70GB OC", { memory_gb: 12 });
    expect(result.corrected).toBe(true);
    expect(result.title).toBe("Foo 8GB Edition RTX 5070 12GB OC");
  });

  test("memory_gb is 0 -> treat as unknown, no change", () => {
    const result = reconcileGpuTitle("ASUS Dual RTX 5070 12GB OC", { memory_gb: 0 });
    expect(result.corrected).toBe(false);
  });

  test("memory_gb is non-numeric -> no change", () => {
    const result = reconcileGpuTitle("ASUS Dual RTX 5070 12GB OC", { memory_gb: "12" });
    expect(result.corrected).toBe(false);
  });

  test("case-insensitive token matching: 'gb' lower-case body token gets normalized", () => {
    const result = reconcileGpuTitle("MSI RTX 5070 70gb OC", { memory_gb: 12 });
    expect(result.corrected).toBe(true);
    expect(result.title).toBe("MSI RTX 5070 12GB OC");
  });
});
