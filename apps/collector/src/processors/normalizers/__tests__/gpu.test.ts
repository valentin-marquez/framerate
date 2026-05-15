/**
 * Tests for GPU title normalizer.
 *
 * Most of these cases are regression tests for a real production bug
 * where `extractVram` matched "70 G" inside "5070 GDDR7" and produced
 * titles like "ASUS Dual RTX 5070 70GB OC" (the 70 GB is nonsense).
 *
 * See `extractVram` in ../gpu.ts.
 */

import { describe, expect, test } from "bun:test";
import { GpuNormalizer, normalizeGpuTitle } from "../gpu";

const { extractVram } = GpuNormalizer;

describe("extractVram", () => {
  test("rejects digit-glued 'G' from inside GDDR (regression — was '70GB')", () => {
    // This is the exact PC Express raw string that produced the production bug.
    expect(extractVram("rtx 5070 gddr7 12gb sdram oc edition")).toBe("12GB");
  });

  test("extracts capacity from lone 'G' after model code (e.g. O8G)", () => {
    expect(extractVram("ASUS DUAL GEFORCE RTX 5060 O8G GDDR7")).toBe("8GB");
  });

  test("extracts capacity from lone 'G' suffix on VRAM number", () => {
    expect(extractVram("ASUS Dual RTX 5070 12G OC Edition")).toBe("12GB");
  });

  test("extracts explicit GB even with GDDR present", () => {
    expect(extractVram("ZOTAC GEFORCE RTX 3060 TWIN EDGE 12GB GDDR6")).toBe("12GB");
  });

  test("extracts 16GB with OC suffix", () => {
    expect(extractVram("GeForce RTX 5060 Ti 16GB OC")).toBe("16GB");
  });

  test("extracts 6GB from GTX title", () => {
    expect(extractVram("GTX 1660 Super 6GB")).toBe("6GB");
  });

  test("extracts 2GB from entry-level GT title", () => {
    expect(extractVram("GT 710 2GB Low Profile")).toBe("2GB");
  });

  test("extracts 32GB from lone 'G' at end of string", () => {
    expect(extractVram("RTX 5090 32G")).toBe("32GB");
  });

  test("returns null when no VRAM is in title (RTX 4070 Ti Super)", () => {
    expect(extractVram("RTX 4070 Ti Super")).toBeNull();
  });

  test("returns null and does not mistake 'Ti' for capacity", () => {
    expect(extractVram("RTX 5060 Ti")).toBeNull();
  });

  // Extra sanity checks
  test("does not match the 'G' inside GDDR by itself", () => {
    expect(extractVram("GDDR6")).toBeNull();
  });

  test("does not produce a number from RTX A4000 (workstation card, no VRAM in title)", () => {
    expect(extractVram("NVIDIA Quadro RTX A4000")).toBeNull();
  });
});

describe("normalizeGpuTitle — end-to-end VRAM regression", () => {
  test("PC Express raw title with 12GB SDRAM normalizes with 12GB (not 70GB)", () => {
    const input = "TARJETA DE VIDEO ASUS DUAL GEFORCE RTX 5070 GDDR7 12GB SDRAM OC EDITION";
    const mpn = "DUAL-RTX5070-O12G";
    const out = normalizeGpuTitle(input, mpn);
    expect(out).toContain("12GB");
    expect(out).not.toContain("70GB");
    expect(out).not.toContain("7GB"); // also defensive
  });

  test("MyShop-style title with 12G OC normalizes with 12GB", () => {
    const input =
      "Tarjeta de Video - ASUS Dual Nvidia GeForce RTX 5070 12G OC Edition - 12 GB, GDDR7, 192 bits - PCIe 5.0 - DisplayPort, HDMI";
    const mpn = "DUAL-RTX5070-O12G";
    const out = normalizeGpuTitle(input, mpn);
    expect(out).toContain("12GB");
    expect(out).not.toContain("70GB");
  });

  test("Zotac twin edge 12GB GDDR6 normalizes correctly", () => {
    const input = "TARJETA DE VIDEO ZOTAC GEFORCE RTX 3060 TWIN EDGE 12GB GDDR6";
    const out = normalizeGpuTitle(input);
    expect(out).toContain("RTX 3060");
    expect(out).toContain("12GB");
    expect(out).not.toContain("60GB");
  });

  test("ASUS Dual O8G with GDDR7 yields 8GB", () => {
    const input = "TARJETA DE VIDEO ASUS DUAL GEFORCE RTX 5060 O8G GDDR7 OC EDITION";
    const out = normalizeGpuTitle(input);
    expect(out).toContain("8GB");
    expect(out).not.toContain("60GB");
    expect(out).not.toContain("80GB");
  });
});
