import { describe, expect, test } from "bun:test";
import { StorageInterfaceRule } from "../index";
import { makeHdd, makeMobo, makeNvmeSsd, makeSataSsd } from "./fixtures";

describe("StorageInterfaceRule", () => {
  test("1 NVMe + 1 HDD en mobo con 2 m.2 + 4 sata => sin issues", () => {
    const issues = StorageInterfaceRule.validate({
      motherboard: makeMobo(),
      ssd: makeNvmeSsd(),
      hdd: makeHdd(),
    });
    expect(issues).toHaveLength(0);
  });

  test("3 NVMe en mobo con 2 m.2 => STORAGE_INTERFACE_EXCEEDED (error)", () => {
    const ssd = makeNvmeSsd();
    ssd.quantity = 3;
    const issues = StorageInterfaceRule.validate({
      motherboard: makeMobo(),
      ssd,
    });
    expect(issues.some((i) => i.code === "STORAGE_INTERFACE_EXCEEDED" && i.severity === "error")).toBe(true);
  });

  test("1 SATA SSD + 5 HDD en mobo con 4 sata => STORAGE_INTERFACE_EXCEEDED", () => {
    const hdd = makeHdd();
    hdd.quantity = 5;
    const issues = StorageInterfaceRule.validate({
      motherboard: makeMobo(),
      ssd: makeSataSsd(),
      hdd,
    });
    expect(issues.some((i) => i.code === "STORAGE_INTERFACE_EXCEEDED" && i.severity === "error")).toBe(true);
  });

  test("mobo sin info de storage (m2_slots null y sata_ports null) => INSUFFICIENT_DATA", () => {
    const issues = StorageInterfaceRule.validate({
      motherboard: makeMobo({ m2_slots: null, sata_ports: null }),
      ssd: makeSataSsd(),
    });
    expect(issues.some((i) => i.code === "INSUFFICIENT_DATA")).toBe(true);
  });
});
