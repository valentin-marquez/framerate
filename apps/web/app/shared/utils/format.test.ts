import { describe, expect, test } from "bun:test";
import { formatSpan } from "./format";

const min = 60_000;

describe("formatSpan", () => {
  test("minutos, horas y días", () => {
    expect(formatSpan(20_000)).toBe("menos de 1 min");
    expect(formatSpan(-5 * min)).toBe("menos de 1 min");
    expect(formatSpan(23 * min)).toBe("23 min");
    expect(formatSpan(252 * min)).toBe("4 h 12 min");
    expect(formatSpan(120 * min)).toBe("2 h");
    expect(formatSpan(50 * 60 * min)).toBe("2 días");
  });
});
