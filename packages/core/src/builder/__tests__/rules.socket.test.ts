import { describe, expect, test } from "bun:test";
import { SocketCompatibilityRule } from "../index";
import { makeCpu, makeMobo } from "./fixtures";

describe("SocketCompatibilityRule", () => {
  test("AM5 CPU + AM5 mobo => sin issues", () => {
    const issues = SocketCompatibilityRule.validate({
      cpu: makeCpu({ socket: "AM5" }),
      motherboard: makeMobo({ socket: "AM5" }),
    });
    expect(issues).toHaveLength(0);
  });

  test("AM4 CPU + AM5 mobo => SOCKET_MISMATCH", () => {
    const issues = SocketCompatibilityRule.validate({
      cpu: makeCpu({ socket: "AM4" }),
      motherboard: makeMobo({ socket: "AM5" }),
    });
    expect(issues.some((i) => i.code === "SOCKET_MISMATCH" && i.severity === "error")).toBe(true);
  });

  test("normalización: 'LGA-1700' === 'LGA 1700'", () => {
    const issues = SocketCompatibilityRule.validate({
      cpu: makeCpu({ socket: "LGA 1700" }),
      motherboard: makeMobo({ socket: "LGA-1700" }),
    });
    expect(issues).toHaveLength(0);
  });

  test("falta socket en CPU => INSUFFICIENT_DATA", () => {
    const issues = SocketCompatibilityRule.validate({
      cpu: makeCpu({ socket: null }),
      motherboard: makeMobo({ socket: "AM5" }),
    });
    expect(issues.some((i) => i.code === "INSUFFICIENT_DATA" && i.severity === "info")).toBe(true);
  });
});
