import { afterEach, describe, expect, test } from "bun:test";
import { BraveSearchProvider } from "../brave";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Respuesta de la Brave Search API con `description` resaltada con <strong>. */
const BRAVE_JSON = JSON.stringify({
  web: {
    results: [
      {
        title: "Intel Core i5-14600KF",
        url: "https://example.com/14600kf",
        description: "El <strong>BX8071514600KF</strong> es la versión boxed del i5-14600KF.",
      },
      { title: "Otro resultado", url: "https://example.com/2", description: "snippet 2" },
    ],
  },
});

function mockFetch(body: string, status = 200): void {
  globalThis.fetch = (() => Promise.resolve(new Response(body, { status }))) as unknown as typeof fetch;
}

describe("BraveSearchProvider", () => {
  test("sin API key devuelve [] (no consulta la red)", async () => {
    const provider = new BraveSearchProvider(undefined);
    expect(await provider.search("Intel Core i5-14600KF", 5)).toEqual([]);
  });

  test("mapea los resultados y limpia el HTML de los snippets", async () => {
    mockFetch(BRAVE_JSON);
    const provider = new BraveSearchProvider("test-key");
    const results = await provider.search("Intel Core i5-14600KF", 5);

    expect(results).toHaveLength(2);
    expect(results[0].title).toBe("Intel Core i5-14600KF");
    expect(results[0].url).toBe("https://example.com/14600kf");
    expect(results[0].snippet).toBe("El BX8071514600KF es la versión boxed del i5-14600KF.");
    expect(results[0].snippet).not.toContain("<strong>");
  });

  test("respeta el límite", async () => {
    mockFetch(BRAVE_JSON);
    const provider = new BraveSearchProvider("test-key");
    expect(await provider.search("algo", 1)).toHaveLength(1);
  });

  test("respuesta no-200 → [] (tolerante a fallos)", async () => {
    mockFetch("rate limited", 429);
    const provider = new BraveSearchProvider("test-key");
    expect(await provider.search("algo", 5)).toEqual([]);
  });

  test("error de red → [] (nunca lanza)", async () => {
    globalThis.fetch = (() => Promise.reject(new Error("network down"))) as unknown as typeof fetch;
    const provider = new BraveSearchProvider("test-key");
    expect(await provider.search("algo", 5)).toEqual([]);
  });

  test("query vacía → []", async () => {
    const provider = new BraveSearchProvider("test-key");
    expect(await provider.search("  ", 5)).toEqual([]);
  });
});
