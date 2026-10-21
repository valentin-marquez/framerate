import { describe, expect, test } from "bun:test";
import { CRAWL_PERIOD_MS, nextSlot, retryDelay, storeOffset } from "./agenda";

describe("agenda", () => {
  test("el desfase es estable, al minuto y dentro del período", () => {
    for (const slug of ["myshop", "pc-express", "tecnomas", "dust2"]) {
      const offset = storeOffset(slug, CRAWL_PERIOD_MS);
      expect(storeOffset(slug, CRAWL_PERIOD_MS)).toBe(offset);
      expect(offset % 60_000).toBe(0);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(CRAWL_PERIOD_MS);
    }
    expect(storeOffset("myshop", CRAWL_PERIOD_MS)).not.toBe(storeOffset("tecnomas", CRAWL_PERIOD_MS));
  });

  test("el próximo slot es >= now y avanza un período al pasarlo", () => {
    const period = 100;
    expect(nextSlot(0, period, 30)).toBe(30);
    expect(nextSlot(30, period, 30)).toBe(30);
    expect(nextSlot(31, period, 30)).toBe(130);
    expect(nextSlot(1000, period, 0)).toBe(1000);
  });

  test("los reintentos esperan 5 min por intento", () => {
    expect(retryDelay(1)).toBe(5 * 60_000);
    expect(retryDelay(2)).toBe(10 * 60_000);
  });
});
