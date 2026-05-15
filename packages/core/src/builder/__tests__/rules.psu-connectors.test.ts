import { describe, expect, test } from "bun:test";
import { PsuConnectorRule } from "../index";
import { makeGpu, makePsu } from "./fixtures";

describe("PsuConnectorRule", () => {
  test("RTX 5070 (12VHPWR) + PSU con 12VHPWR => sin issues", () => {
    const issues = PsuConnectorRule.validate({
      gpu: makeGpu(),
      psu: makePsu(),
    });
    expect(issues).toHaveLength(0);
  });

  test("GPU pide 12VHPWR pero PSU no tiene => MISSING_12VHPWR error", () => {
    const issues = PsuConnectorRule.validate({
      gpu: makeGpu({ power_connectors: { pcie_6_pin: 0, pcie_8_pin: 0, pcie_12vhpwr: 1 } }),
      psu: makePsu({
        connectors: {
          atx_24_pin: 1,
          eps_8_pin: 2,
          pcie_12vhpwr: 0,
          pcie_6_plus_2_pin: 4,
          sata: 6,
          molex: 4,
        },
      }),
    });
    expect(issues.some((i) => i.code === "MISSING_12VHPWR" && i.severity === "error")).toBe(true);
  });

  test("GPU pide 3x 8-pin pero PSU solo tiene 1 6+2 => INSUFFICIENT_PCIE_CONNECTORS warning", () => {
    const issues = PsuConnectorRule.validate({
      gpu: makeGpu({ power_connectors: { pcie_6_pin: 0, pcie_8_pin: 3, pcie_12vhpwr: 0 } }),
      psu: makePsu({
        connectors: {
          atx_24_pin: 1,
          eps_8_pin: 2,
          pcie_12vhpwr: 0,
          pcie_6_plus_2_pin: 1,
          sata: 6,
          molex: 4,
        },
      }),
    });
    expect(issues.some((i) => i.code === "INSUFFICIENT_PCIE_CONNECTORS" && i.severity === "warning")).toBe(true);
  });

  test("GPU sin power_connectors => INSUFFICIENT_DATA", () => {
    const issues = PsuConnectorRule.validate({
      gpu: makeGpu({ power_connectors: null }),
      psu: makePsu(),
    });
    expect(issues.some((i) => i.code === "INSUFFICIENT_DATA")).toBe(true);
  });
});
