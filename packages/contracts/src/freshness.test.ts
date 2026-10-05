import { describe, expect, test } from "bun:test";
import { nextCrawlAt } from "./catalog";

describe("nextCrawlAt", () => {
  const next = (iso: string) => nextCrawlAt(new Date(iso)).toISOString();

  test("la próxima corrida es la siguiente hora múltiplo de 6 a los :17 UTC", () => {
    expect(next("2026-10-05T04:30:00Z")).toBe("2026-10-05T06:17:00.000Z");
    expect(next("2026-10-05T06:16:59Z")).toBe("2026-10-05T06:17:00.000Z");
  });

  test("justo en la hora del cron ya cuenta la siguiente", () => {
    expect(next("2026-10-05T06:17:00Z")).toBe("2026-10-05T12:17:00.000Z");
  });

  test("cruza la medianoche", () => {
    expect(next("2026-10-05T23:50:00Z")).toBe("2026-10-06T00:17:00.000Z");
  });
});
