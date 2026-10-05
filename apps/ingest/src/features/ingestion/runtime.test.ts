import { expect, test } from "bun:test";
import { enqueueAllCrawls } from "./runtime";
import { STORES } from "./stores/registry";

test("el cron no encola tiendas pausadas", async () => {
  const sent: { body: { store: string } }[] = [];
  const env = { CRAWL_QUEUE: { sendBatch: async (m: typeof sent) => void sent.push(...m) } };
  await enqueueAllCrawls(env as never, "test");
  expect(sent.length).toBeGreaterThan(0);
  const paused = STORES.filter((s) => s.pausedReason).map((s) => s.slug);
  expect(paused).toContain("tytgamer");
  expect(sent.some((m) => paused.includes(m.body.store))).toBe(false);
});
