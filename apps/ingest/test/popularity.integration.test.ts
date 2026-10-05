import { afterAll, beforeAll, expect, test } from "bun:test";
import { catalogVersion, type Db } from "@framerate/database";
import { createTestD1 } from "@framerate/database/testing";
import { applyViews7d, fetchViews7d } from "@/features/popularity/views";

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ db, dispose } = await createTestD1());
});
afterAll(() => dispose());

const T0 = "2026-10-01T00:00:00.000Z";

test("views_7d sale de Analytics Engine y reemplaza el valor anterior", async () => {
  for (const [slug, views_7d] of [
    ["a", 9],
    ["b", 0],
    ["c", 4],
  ] as const) {
    await db.query
      .insertInto("products")
      .values({ slug, name: slug, category: "gpu", views_7d, created_at: T0, updated_at: T0 })
      .execute();
  }
  // Analytics Engine devuelve los UInt64 como texto.
  const fetcher = (async () =>
    Response.json({
      data: [
        { slug: "b", views: "5" },
        { slug: "no-existe", views: "2" },
      ],
    })) as unknown as typeof fetch;

  await applyViews7d(db, await fetchViews7d("cuenta", "token", fetcher));

  const rows = await db.query.selectFrom("products").select(["slug", "views_7d"]).orderBy("slug").execute();
  expect(rows).toEqual([
    { slug: "a", views_7d: 0 },
    { slug: "b", views_7d: 5 },
    { slug: "c", views_7d: 0 },
  ]);
  expect(await catalogVersion(db)).toBe(1);
});
