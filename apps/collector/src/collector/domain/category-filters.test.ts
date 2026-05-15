import { describe, expect, test } from "bun:test";
import { isAllowedForCategory, isMpnBlocked, MPN_BLOCKLIST } from "./category-filters";

describe("isMpnBlocked", () => {
  test("blocks each of the 4 seeded accessory MPNs (exact form)", () => {
    expect(isMpnBlocked("0-761345-70001-6")).toBe(true);
    expect(isMpnBlocked("100-2W-0029-LR")).toBe(true);
    expect(isMpnBlocked("TPM-M")).toBe(true);
    expect(isMpnBlocked("TPM-SPI")).toBe(true);
  });

  test("matches across casing / punctuation differences (normalized)", () => {
    expect(isMpnBlocked("tpm-m")).toBe(true);
    expect(isMpnBlocked("tpm m")).toBe(true);
    expect(isMpnBlocked("100 2W 0029 LR")).toBe(true);
  });

  test("does not block a real MPN", () => {
    expect(isMpnBlocked("DUAL-RTX5070-O12G")).toBe(false);
    expect(isMpnBlocked("B650M-A")).toBe(false);
  });

  test("returns false for null / undefined / empty", () => {
    expect(isMpnBlocked(null)).toBe(false);
    expect(isMpnBlocked(undefined)).toBe(false);
    expect(isMpnBlocked("")).toBe(false);
    expect(isMpnBlocked("   ")).toBe(false);
  });

  test("MPN_BLOCKLIST contains the 4 seeded entries verbatim", () => {
    expect(MPN_BLOCKLIST.has("0-761345-70001-6")).toBe(true);
    expect(MPN_BLOCKLIST.has("100-2W-0029-LR")).toBe(true);
    expect(MPN_BLOCKLIST.has("TPM-M")).toBe(true);
    expect(MPN_BLOCKLIST.has("TPM-SPI")).toBe(true);
  });
});

describe("isAllowedForCategory — rejects the 4 known-bad products", () => {
  test("Cable Riser Antec is rejected for gpu (CABLE / RISER)", () => {
    const result = isAllowedForCategory("Cable Riser Antec PCI 4.0 White AT-RCVB-W200-PCIE4-RTX40", "gpu");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  test("EVGA NVLink bridge is rejected for gpu (NVLINK / BRIDGE)", () => {
    const result = isAllowedForCategory("Bridge EVGA NVIDIA NVLink 3 Slot", "gpu");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  test("Asus TPM-M module is rejected for motherboard (TPM / MODULE)", () => {
    const result = isAllowedForCategory("Asus TPM-M R2.0 Module", "motherboard");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  test("Asus TPM-SPI module is rejected for motherboard (TPM / MODULE)", () => {
    const result = isAllowedForCategory("Asus TPM-SPI Module", "motherboard");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });
});

describe("isAllowedForCategory — happy path", () => {
  test("a real RTX 4070 title is allowed for gpu", () => {
    const result = isAllowedForCategory("ASUS Dual GeForce RTX 4070 OC 12GB GDDR6X", "gpu");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test("a real B650 motherboard title is allowed for motherboard", () => {
    const result = isAllowedForCategory("ASUS PRIME B650M-A AX II AMD AM5 Placa Madre DDR5", "motherboard");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test("empty / whitespace title is rejected with explicit reason", () => {
    expect(isAllowedForCategory("", "gpu").allowed).toBe(false);
    expect(isAllowedForCategory("   ", "gpu").allowed).toBe(false);
    expect(isAllowedForCategory(null, "gpu").allowed).toBe(false);
    expect(isAllowedForCategory(undefined, "gpu").allowed).toBe(false);
  });
});
