import { describe, expect, test } from "bun:test";
import { formatDuration, timeAgo } from "./time";

const NOW = "2026-10-02T12:00:00.000Z";
const ago = (ms: number) => new Date(Date.parse(NOW) - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;

describe("timeAgo", () => {
  test("minutos, horas y días, según qué tan atrás", () => {
    expect(timeAgo(ago(20_000), NOW)).toBe("hace un momento");
    expect(timeAgo(ago(5 * MIN), NOW)).toBe("hace 5 min");
    expect(timeAgo(ago(3 * HOUR + 10 * MIN), NOW)).toBe("hace 3 h");
    expect(timeAgo(ago(47 * HOUR), NOW)).toBe("hace 47 h");
    expect(timeAgo(ago(72 * HOUR), NOW)).toBe("hace 3 d");
  });

  test("una hora en el futuro por desfase de relojes no da números negativos", () => {
    expect(timeAgo(ago(-5 * MIN), NOW)).toBe("hace un momento");
  });
});

describe("formatDuration", () => {
  test("segundos, minutos con segundos y horas", () => {
    expect(formatDuration(400)).toBe("menos de 1 s");
    expect(formatDuration(47_000)).toBe("47 s");
    expect(formatDuration(111_000)).toBe("1 min 51 s");
    expect(formatDuration(5 * MIN)).toBe("5 min");
    expect(formatDuration(2 * HOUR + 30 * MIN)).toBe("2 h 30 min");
  });
});
