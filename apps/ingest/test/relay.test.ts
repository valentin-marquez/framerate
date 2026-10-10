import { describe, expect, test } from "bun:test";
import { silentLogger as log } from "@framerate/kit";
import { createHttpClient, type Fetch } from "@/features/ingestion/stores/http";
import { STORES } from "@/features/ingestion/stores/registry";
import { relayFetch } from "@/features/ingestion/stores/relay";
import { RELAY_HOSTS } from "../../relay/src/hosts";

const calls: string[] = [];
const fake =
  (relay: (url: string) => Response | Error): Fetch =>
  async (input, init) => {
    const url = String(input);
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (!url.startsWith("https://relay.test/")) return new Response("directo");
    const out = relay(url);
    if (out instanceof Error) throw out;
    return out;
  };

describe("relayFetch", () => {
  test("va por el relay con el token y la URL codificada, y devuelve la respuesta de la tienda", async () => {
    calls.length = 0;
    const seen: { auth: string | null } = { auth: null };
    const withAuth: Fetch = async (input, init) => {
      seen.auth = new Headers(init?.headers).get("authorization");
      return fake(() => new Response("por relay", { headers: { "x-relay": "1" } }))(input, init);
    };
    const http = createHttpClient({
      fetch: relayFetch({ url: "https://relay.test/", token: "t", log, fetch: withAuth }),
    });
    expect((await http.get("https://tienda.cl/a?b=1", { accept: "text/html" })).text).toBe("por relay");
    expect(calls).toEqual(["GET https://relay.test/fetch?url=https%3A%2F%2Ftienda.cl%2Fa%3Fb%3D1"]);
    expect(seen.auth).toBe("Bearer t");
  });

  test("relay caído (error o respuesta sin marca) → directo por el resto de la corrida", async () => {
    for (const relay of [() => new Error("túnel"), () => new Response("502 del túnel", { status: 502 })]) {
      calls.length = 0;
      const http = createHttpClient({
        fetch: relayFetch({ url: "https://relay.test", token: "t", log, fetch: fake(relay) }),
      });
      expect((await http.get("https://tienda.cl/a")).text).toBe("directo");
      expect((await http.get("https://tienda.cl/b")).text).toBe("directo");
      expect(calls).toEqual([
        "GET https://relay.test/fetch?url=https%3A%2F%2Ftienda.cl%2Fa",
        "GET https://tienda.cl/a",
        "GET https://tienda.cl/b",
      ]);
    }
  });

  test("un 429 sin Retry-After espera 15 s, 30 s… (límite por minuto); con Retry-After, lo que pide", async () => {
    const waits: number[] = [];
    let n = 0;
    const http = createHttpClient({
      minIntervalMs: 0,
      sleep: async (ms) => {
        waits.push(ms);
      },
      fetch: async () =>
        n++ < 2
          ? new Response("", { status: 429 })
          : n === 3
            ? new Response("", { status: 429, headers: { "retry-after": "7" } })
            : new Response("ok"),
    });
    expect((await http.get("https://tienda.cl/a")).text).toBe("ok");
    expect(waits).toEqual([15_000, 30_000, 7_000]);
  });

  test("un 429 de la tienda a través del relay se reintenta por el relay", async () => {
    calls.length = 0;
    let n = 0;
    const relay = () =>
      n++ === 0
        ? new Response("", { status: 429, headers: { "x-relay": "1" } })
        : new Response("ok", { headers: { "x-relay": "1" } });
    const http = createHttpClient({
      fetch: relayFetch({ url: "https://relay.test", token: "t", log, fetch: fake(relay) }),
      sleep: async () => {},
    });
    expect((await http.get("https://tienda.cl/a")).text).toBe("ok");
    expect(calls.every((c) => c.includes("relay.test"))).toBe(true);
  });

  test("render va a /render del relay; sin relay o con el relay caído, falla en vez de traer el HTML crudo", async () => {
    calls.length = 0;
    let headers = new Headers();
    const relay: Fetch = async (input, init) => {
      headers = new Headers(init?.headers);
      return fake(() => new Response("<html>render</html>", { headers: { "x-relay": "1" } }))(input, init);
    };
    const http = createHttpClient({
      renders: true,
      fetch: relayFetch({ url: "https://relay.test", token: "t", log, fetch: relay }),
    });
    expect((await http.get("https://tienda.cl/p", { accept: "text/html", render: true })).text).toBe(
      "<html>render</html>",
    );
    expect(calls).toEqual(["GET https://relay.test/render?url=https%3A%2F%2Ftienda.cl%2Fp"]);
    expect(headers.get("x-framerate-render")).toBeNull();
    await http.get("https://tienda.cl/q", { accept: "text/html", render: ".precio" });
    expect(calls[1]).toBe("GET https://relay.test/render?url=https%3A%2F%2Ftienda.cl%2Fq&wait=.precio");
    expect(headers.get("authorization")).toBe("Bearer t");

    expect(() =>
      createHttpClient({ fetch: fake(() => new Response("")) }).get("https://tienda.cl/p", { render: true }),
    ).toThrow("render requiere");
    const caido = createHttpClient({
      renders: true,
      retries: 0,
      fetch: relayFetch({
        url: "https://relay.test",
        token: "t",
        log,
        fetch: fake(() => new Response("502", { status: 502 })),
      }),
    });
    await expect(caido.get("https://tienda.cl/p", { render: true })).rejects.toThrow("relay caído");
  });

  test("toda tienda con egress relay está en la lista de dominios del relay", () => {
    for (const store of STORES.filter((s) => s.egress === "relay")) {
      expect(RELAY_HOSTS).toContain(new URL(store.url).hostname);
    }
  });
});
