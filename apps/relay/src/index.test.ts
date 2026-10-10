import { describe, expect, test } from "bun:test";
import { type Fetch, handle } from "./index";

const TOKEN = "secreto";
const calls: { url: string; init: RequestInit }[] = [];
const upstream =
  (status = 200, headers: Record<string, string> = {}, body = "<html>ok</html>"): Fetch =>
  async (url, init) => {
    calls.push({ url, init });
    return new Response(body, { status, headers });
  };

const relay = (path: string, init: RequestInit = {}, fetch = upstream()) =>
  handle(new Request(`http://relay.local${path}`, { headers: { Authorization: `Bearer ${TOKEN}` }, ...init }), {
    token: TOKEN,
    fetch,
    hosts: ["tienda.cl"],
  });

describe("relay", () => {
  test("health sin token", async () => {
    expect((await handle(new Request("http://relay.local/health"), { token: TOKEN })).status).toBe(200);
  });

  test("sin token o con token distinto → 403, sin tocar la tienda", async () => {
    calls.length = 0;
    const sin = await handle(new Request("http://relay.local/fetch?url=https://tienda.cl/"), { token: TOKEN });
    const malo = await relay("/fetch?url=https://tienda.cl/", { headers: { Authorization: "Bearer otro" } });
    expect([sin.status, malo.status]).toEqual([403, 403]);
    expect(calls).toHaveLength(0);
  });

  test("dominio fuera de la lista → 403; URL rota → 403", async () => {
    expect((await relay("/fetch?url=https://otra.cl/")).status).toBe(403);
    expect((await relay("/fetch?url=nada")).status).toBe(403);
    expect((await relay("/fetch")).status).toBe(403);
    expect((await relay("/fetch?url=https://tienda.cl:8443/")).status).toBe(403);
    expect((await relay("/fetch?url=http://tienda.cl:22/")).status).toBe(403);
    expect((await relay("/fetch?url=https://user:pw@tienda.cl/")).status).toBe(403);
  });

  test("GET permitido: pasa estado, content-type y cuerpo, con el user agent del Worker", async () => {
    calls.length = 0;
    const res = await relay("/fetch?url=https://tienda.cl/p?x=1", {
      headers: { Authorization: `Bearer ${TOKEN}`, "User-Agent": "FramerateBot/1.0", Accept: "text/html" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-relay")).toBe("1");
    expect(await res.text()).toBe("<html>ok</html>");
    expect(calls[0]?.url).toBe("https://tienda.cl/p?x=1");
    const sent = new Headers(calls[0]?.init.headers);
    expect(sent.get("user-agent")).toBe("FramerateBot/1.0");
    expect(sent.get("accept")).toBe("text/html");
  });

  test("429 y retry-after vuelven tal cual (el Worker reintenta)", async () => {
    const res = await relay("/fetch?url=https://tienda.cl/", {}, upstream(429, { "retry-after": "7" }, "slow"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("7");
  });

  test("POST reenvía el cuerpo JSON", async () => {
    calls.length = 0;
    await relay("/fetch?url=https://tienda.cl/servicio", {
      method: "POST",
      body: '{"a":1}',
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    });
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.body).toBe('{"a":1}');
  });

  test("sigue redirecciones dentro de la lista y corta las que salen", async () => {
    calls.length = 0;
    const hops = (async (url) => {
      calls.push({ url: String(url), init: {} });
      if (String(url) === "https://tienda.cl/a")
        return new Response(null, { status: 301, headers: { location: "/b" } });
      if (String(url) === "https://tienda.cl/b") return new Response("fin");
      return new Response(null, { status: 302, headers: { location: "https://otra.cl/" } });
    }) as typeof fetch;
    expect(await (await relay("/fetch?url=https://tienda.cl/a", {}, hops)).text()).toBe("fin");
    expect((await relay("/fetch?url=https://tienda.cl/fuera", {}, hops)).status).toBe(403);
    expect(calls.map((c) => c.url)).toEqual(["https://tienda.cl/a", "https://tienda.cl/b", "https://tienda.cl/fuera"]);
  });

  test("respuesta más grande que el tope → 502, aunque no declare content-length", async () => {
    const big = new ReadableStream({
      pull(c) {
        c.enqueue(new Uint8Array(1024 * 1024));
      },
    });
    const res = await relay("/fetch?url=https://tienda.cl/", {}, async () => new Response(big));
    expect(res.status).toBe(502);
    const declared = await relay("/fetch?url=https://tienda.cl/", {}, upstream(200, { "content-length": "999999999" }));
    expect(declared.status).toBe(502);
  });

  test("si la tienda no responde, 502 marcado como del relay", async () => {
    const res = await relay("/fetch?url=https://tienda.cl/", {}, async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(res.status).toBe(502);
    expect(res.headers.get("x-relay")).toBe("1");
  });
});
