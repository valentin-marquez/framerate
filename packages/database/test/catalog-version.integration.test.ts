import { afterAll, beforeAll, expect, test } from "bun:test";
import { bumpCatalogVersion, catalogVersion } from "../src/catalog-version";
import type { Db } from "../src/client";
import { refreshPriceSummary } from "../src/price-summary";
import { createTestD1 } from "../src/testing";

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ db, dispose } = await createTestD1());
});
afterAll(() => dispose());

test("cada corrida y cada bump suben la versión del catálogo", async () => {
  expect(await catalogVersion(db)).toBe(0);
  await refreshPriceSummary(db, { storeId: 1, category: "gpu", previousProductIds: [], now: new Date() });
  expect(await catalogVersion(db)).toBe(1);
  await bumpCatalogVersion(db);
  expect(await catalogVersion(db)).toBe(2);
});
