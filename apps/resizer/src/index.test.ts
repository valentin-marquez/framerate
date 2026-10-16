import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { handle } from "./index";

const TOKEN = "secreto";
const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#c33" } })
    .jpeg()
    .toBuffer();

const resize = (body: Buffer | string, w: string | number = 400, token = TOKEN) =>
  handle(
    new Request(`http://resizer.local/resize?w=${w}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    }),
    TOKEN,
  );

describe("resizer", () => {
  test("health sin token; sin token o con otro → 403", async () => {
    expect((await handle(new Request("http://resizer.local/health"), TOKEN)).status).toBe(200);
    expect((await resize(await photo(10, 10), 400, "otro")).status).toBe(403);
  });

  test("achica a WebP del ancho pedido, sin agrandar las chicas", async () => {
    const big = await resize(await photo(1200, 900), 400);
    expect(big.headers.get("content-type")).toBe("image/webp");
    expect(await sharp(await big.arrayBuffer()).metadata()).toMatchObject({ format: "webp", width: 400, height: 300 });

    const small = await resize(await photo(300, 300), 800);
    expect((await sharp(await small.arrayBuffer()).metadata()).width).toBe(300);
  });

  test("ancho fuera de la lista → 400; lo que no es foto → 422", async () => {
    expect((await resize(await photo(10, 10), 123)).status).toBe(400);
    expect((await resize("<html>no</html>")).status).toBe(422);
  });
});
