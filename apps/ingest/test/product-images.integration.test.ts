import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { silentLogger } from "@framerate/kit";
import {
  addSmallVariants,
  copyProductImages,
  imageExtension,
  type Resize,
  ResizerDown,
} from "@/features/images/product-images";

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

/** Resizer falso: devuelve "webp-<ancho>" y anota cada ancho pedido. */
function fakeResize(fail?: Error) {
  const calls: number[] = [];
  const resize: Resize = async (_image, width) => {
    if (fail) throw fail;
    calls.push(width);
    return new TextEncoder().encode(`webp-${width}`).buffer as ArrayBuffer;
  };
  return { resize, calls };
}

function fakeBucket(initial: string[] = []) {
  const puts = new Map<string, { contentType?: string; cacheControl?: string }>();
  const bodies = new Map<string, unknown>(initial.map((key) => [key, "webp-800"]));
  const bucket = {
    put: async (key: string, body: unknown, options?: R2PutOptions) => {
      puts.set(key, options?.httpMetadata as { contentType?: string });
      bodies.set(key, body);
    },
    get: async (key: string) => (bodies.has(key) ? { arrayBuffer: async () => new ArrayBuffer(1) } : null),
    // De a dos por página, para pasar por el cursor.
    list: async ({ cursor }: R2ListOptions) => {
      const keys = [...bodies.keys()].sort();
      const from = Number(cursor ?? 0);
      const objects = keys.slice(from, from + 2).map((key) => ({ key }));
      const truncated = from + 2 < keys.length;
      return { objects, truncated, cursor: truncated ? String(from + 2) : undefined };
    },
  } as unknown as Pick<R2Bucket, "put" | "get" | "list">;
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

  test("guarda la foto achicada en WebP, con clave por la original: la misma foto en dos productos es un objeto", async () => {
    await product("a", "https://alfa.cl/a.jpg");
    await product("b", "https://beta.cl/misma.jpg");
    await product("sin-foto", null);
    // PNG servido como image/jpeg (pasa en tiendas reales).
    const png = () => new Response(PNG, { headers: { "content-type": "image/jpeg" } });
    const { fetchImage } = fakeFetch({ "https://alfa.cl/a.jpg": png, "https://beta.cl/misma.jpg": png });
    const { bucket, puts } = fakeBucket();

    const { resize, calls } = fakeResize();

    expect(await copyProductImages(db, bucket, resize, T0, silentLogger, fetchImage)).toEqual({ copied: 2, failed: 0 });

    const [key, small] = [...puts.keys()];
    expect(puts.size).toBe(2);
    expect(calls).toEqual([800, 400, 800, 400]);
    expect(key).toMatch(/^products\/[0-9a-f]{32}\.webp$/);
    expect(small).toBe((key as string).replace(".webp", "-w400.webp"));
    expect(puts.get(key as string)).toEqual({
      contentType: "image/webp",
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
    const { resize, calls: processed } = fakeResize();

    expect(await copyProductImages(db, bucket, resize, T0, silentLogger, fetchImage)).toEqual({ copied: 1, failed: 2 });
    // El HTML con 200 se descarta antes de mandarlo al resizer.
    expect(processed).toEqual([800, 400]);
    const failed = (await all(db, "products")).filter((r) => r.image_key === null);
    expect(failed.map((r) => r.image_checked_at)).toEqual([T0, T0]);

    calls.length = 0;
    expect(await copyProductImages(db, bucket, resize, "2026-10-01T06:00:00.000Z", silentLogger, fetchImage)).toEqual({
      copied: 0,
      failed: 0,
    });
    expect(calls).toEqual([]);

    await copyProductImages(db, bucket, resize, nextDay, silentLogger, fetchImage);
    expect(calls.sort()).toEqual(["https://alfa.cl/borrada.png", "https://alfa.cl/hotlink.png"]);
  });

  test("con el resizer caído no se marca nada: se reintenta en la próxima corrida, no al día siguiente", async () => {
    await product("a", "https://alfa.cl/a.png");
    await product("b", "https://alfa.cl/b.png");
    const { fetchImage, calls } = fakeFetch({ "https://alfa.cl/a.png": () => new Response(PNG) });
    const { bucket, puts } = fakeBucket();
    const { resize } = fakeResize(new ResizerDown("HTTP 502"));

    expect(await copyProductImages(db, bucket, resize, T0, silentLogger, fetchImage)).toEqual({ copied: 0, failed: 0 });
    expect(calls).toEqual(["https://alfa.cl/a.png"]);
    expect(puts.size).toBe(0);
    expect((await all(db, "products")).map((r) => r.image_checked_at)).toEqual([null, null]);
  });

  test("relleno: agrega la de 400 a las copias viejas y no repite las que ya la tienen", async () => {
    const old = (n: number) => `products/${String(n).padStart(32, "0")}.webp`;
    const { bucket, puts } = fakeBucket([old(1), old(2), old(2).replace(".webp", "-w400.webp"), "stores/x/icon.webp"]);
    const { resize, calls } = fakeResize();

    expect(await addSmallVariants(bucket, resize, silentLogger)).toEqual({ added: 1, failed: 0, remaining: 0 });
    expect([...puts.keys()]).toEqual([old(1).replace(".webp", "-w400.webp")]);
    expect(calls).toEqual([400]);
    expect(await addSmallVariants(bucket, resize, silentLogger)).toEqual({ added: 0, failed: 0, remaining: 0 });
  });
});
