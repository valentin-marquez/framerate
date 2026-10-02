import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { silentLogger } from "@framerate/kit";
import { copyProductImages, imageExtension } from "@/features/images/product-images";

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
});
afterAll(() => dispose());
beforeEach(() => resetD1(d1));

const T0 = "2026-10-01T00:00:00.000Z";
const nextDay = "2026-10-02T00:00:01.000Z";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

function product(slug: string, image_url: string | null) {
  return db.query
    .insertInto("products")
    .values({ slug, name: slug, category: "gpu", image_url, created_at: T0, updated_at: T0 })
    .execute();
}

/** Tienda falsa: responde según la URL y anota cada pedido. */
function fakeFetch(routes: Record<string, () => Response>) {
  const calls: string[] = [];
  const fetchImage = (async (url: string) => {
    calls.push(url);
    return routes[url]?.() ?? new Response("no", { status: 404 });
  }) as unknown as typeof fetch;
  return { fetchImage, calls };
}

function fakeBucket() {
  const puts = new Map<string, { contentType?: string; cacheControl?: string }>();
  const bucket = {
    put: async (key: string, _body: unknown, options?: R2PutOptions) => {
      puts.set(key, options?.httpMetadata as { contentType?: string });
    },
  } as unknown as Pick<R2Bucket, "put">;
  return { bucket, puts };
}

describe("copia de fotos de producto a R2", () => {
  test("detecta el formato por los bytes, no por Content-Type", () => {
    expect(imageExtension(PNG)).toBe("png");
    expect(imageExtension(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(imageExtension(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("webp");
    expect(imageExtension(new TextEncoder().encode("<!DOCTYPE html>"))).toBeNull();
    expect(imageExtension(new TextEncoder().encode("<svg xmlns="))).toBeNull();
  });

  test("copia con clave por contenido: la misma foto en dos productos es un solo objeto", async () => {
    await product("a", "https://alfa.cl/a.jpg");
    await product("b", "https://beta.cl/misma.jpg");
    await product("sin-foto", null);
    // PNG servido como image/jpeg (pasa en tiendas reales).
    const png = () => new Response(PNG, { headers: { "content-type": "image/jpeg" } });
    const { fetchImage } = fakeFetch({ "https://alfa.cl/a.jpg": png, "https://beta.cl/misma.jpg": png });
    const { bucket, puts } = fakeBucket();

    expect(await copyProductImages(db, bucket, T0, silentLogger, fetchImage)).toEqual({ copied: 2, failed: 0 });

    const [key] = [...puts.keys()];
    expect(puts.size).toBe(1);
    expect(key).toMatch(/^products\/[0-9a-f]{32}\.png$/);
    expect(puts.get(key as string)).toEqual({
      contentType: "image/png",
      cacheControl: "public, max-age=31536000, immutable",
    });
    const rows = await all(db, "products");
    expect(rows.map((r) => [r.slug, r.image_key])).toEqual([
      ["a", key as string],
      ["b", key as string],
      ["sin-foto", null],
    ]);
  });

  test("lo que falla no se reintenta en cada corrida, sino al día siguiente; lo copiado no se vuelve a pedir", async () => {
    await product("ok", "https://alfa.cl/ok.png");
    await product("borrada", "https://alfa.cl/borrada.png");
    await product("html", "https://alfa.cl/hotlink.png");
    const { fetchImage, calls } = fakeFetch({
      "https://alfa.cl/ok.png": () => new Response(PNG),
      "https://alfa.cl/hotlink.png": () => new Response("<html>no hotlinking</html>", { status: 200 }),
    });
    const { bucket } = fakeBucket();

    expect(await copyProductImages(db, bucket, T0, silentLogger, fetchImage)).toEqual({ copied: 1, failed: 2 });
    const failed = (await all(db, "products")).filter((r) => r.image_key === null);
    expect(failed.map((r) => r.image_checked_at)).toEqual([T0, T0]);

    calls.length = 0;
    expect(await copyProductImages(db, bucket, "2026-10-01T06:00:00.000Z", silentLogger, fetchImage)).toEqual({
      copied: 0,
      failed: 0,
    });
    expect(calls).toEqual([]);

    await copyProductImages(db, bucket, nextDay, silentLogger, fetchImage);
    expect(calls.sort()).toEqual(["https://alfa.cl/borrada.png", "https://alfa.cl/hotlink.png"]);
  });
});
