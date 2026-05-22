/**
 * Tests del parser de DuckDuckGo. Se prueba `parseResults` con fixtures
 * de HTML fijo — sin requests de red reales.
 */

import { describe, expect, test } from "bun:test";
import { DuckDuckGoProvider, parseResults } from "../duckduckgo";

/**
 * Fixture estilo página de resultados de DuckDuckGo HTML. Tres resultados:
 *  - dos con redirect `/l/?uddg=...`
 *  - uno con URL directa y entidades HTML en el texto.
 */
const FIXTURE_HTML = `
<!DOCTYPE html>
<html><body>
<div class="result results_links results_links_deep web-result">
  <div class="result__body">
    <h2 class="result__title">
      <a rel="nofollow" class="result__a" href="/l/?uddg=https%3A%2F%2Fwww.example.com%2Fgpu-rtx-4070&amp;rut=abc">
        NVIDIA GeForce RTX 4070 &amp; Specs
      </a>
    </h2>
    <a class="result__snippet" href="/l/?uddg=https%3A%2F%2Fwww.example.com%2Fgpu-rtx-4070">
      The <b>RTX 4070</b> is a powerful GPU with 12GB GDDR6X memory.
    </a>
  </div>
</div>
<div class="result results_links results_links_deep web-result">
  <div class="result__body">
    <h2 class="result__title">
      <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fshop.test%2Fproduct%3Fid%3D99">
        Test Product &#8212; Buy Now
      </a>
    </h2>
    <a class="result__snippet">In stock &amp; ready to ship.</a>
  </div>
</div>
<div class="result results_links results_links_deep web-result">
  <div class="result__body">
    <h2 class="result__title">
      <a rel="nofollow" class="result__a" href="https://direct.example.org/page">
        Direct Link Result
      </a>
    </h2>
    <span class="result__snippet">A snippet with no redirect wrapper.</span>
  </div>
</div>
</body></html>
`;

describe("parseResults", () => {
  test("parsea correctamente los 3 resultados del fixture", () => {
    const results = parseResults(FIXTURE_HTML);
    expect(results).toHaveLength(3);
  });

  test("limpia tags HTML y decodifica entidades en el título", () => {
    const [first] = parseResults(FIXTURE_HTML);
    expect(first?.title).toBe("NVIDIA GeForce RTX 4070 & Specs");
  });

  test("limpia tags HTML y decodifica entidades en el snippet", () => {
    const [first] = parseResults(FIXTURE_HTML);
    expect(first?.snippet).toBe("The RTX 4070 is a powerful GPU with 12GB GDDR6X memory.");
  });

  test("desenvuelve el redirect uddg a la URL real", () => {
    const [first] = parseResults(FIXTURE_HTML);
    expect(first?.url).toBe("https://www.example.com/gpu-rtx-4070");
  });

  test("desenvuelve uddg en redirects protocol-relative (//duckduckgo.com/l/)", () => {
    const results = parseResults(FIXTURE_HTML);
    expect(results[1]?.url).toBe("https://shop.test/product?id=99");
  });

  test("decodifica entidades numéricas en el título (&#8212; → em dash)", () => {
    const results = parseResults(FIXTURE_HTML);
    expect(results[1]?.title).toBe("Test Product — Buy Now");
  });

  test("deja intacta la URL directa cuando no hay redirect", () => {
    const results = parseResults(FIXTURE_HTML);
    expect(results[2]?.url).toBe("https://direct.example.org/page");
  });

  test("HTML vacío devuelve []", () => {
    expect(parseResults("")).toEqual([]);
  });

  test("HTML sin resultados devuelve []", () => {
    expect(parseResults("<html><body><p>nada por aquí</p></body></html>")).toEqual([]);
  });

  test("ignora anchors sin título visible", () => {
    const html = `<a class="result__a" href="/l/?uddg=https%3A%2F%2Fx.com"></a>`;
    expect(parseResults(html)).toEqual([]);
  });

  test("resultado sin snippet asociado deja snippet vacío", () => {
    const html = `
      <a class="result__a" href="https://only-title.example">Solo Título</a>
    `;
    const results = parseResults(html);
    expect(results).toHaveLength(1);
    expect(results[0]?.snippet).toBe("");
  });
});

describe("DuckDuckGoProvider", () => {
  test("name es 'duckduckgo'", () => {
    expect(new DuckDuckGoProvider().name).toBe("duckduckgo");
  });

  test("search con query vacía devuelve [] sin tocar la red", async () => {
    const provider = new DuckDuckGoProvider();
    expect(await provider.search("", 10)).toEqual([]);
    expect(await provider.search("   ", 10)).toEqual([]);
  });

  test("search con limit <= 0 devuelve []", async () => {
    const provider = new DuckDuckGoProvider();
    expect(await provider.search("rtx 4070", 0)).toEqual([]);
  });

  test("search nunca lanza ante un fetch fallido (devuelve [])", async () => {
    const provider = new DuckDuckGoProvider();
    const originalFetch = globalThis.fetch;
    // Simular un fallo de red.
    globalThis.fetch = (() => Promise.reject(new Error("network down"))) as unknown as typeof fetch;
    try {
      expect(await provider.search("rtx 4070", 5)).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("search devuelve [] ante respuesta no-200", async () => {
    const provider = new DuckDuckGoProvider();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve(new Response("error", { status: 503 }))) as unknown as typeof fetch;
    try {
      expect(await provider.search("rtx 4070", 5)).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("search parsea el HTML y respeta el limit", async () => {
    const provider = new DuckDuckGoProvider();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve(new Response(FIXTURE_HTML, { status: 200 }))) as unknown as typeof fetch;
    try {
      const results = await provider.search("rtx 4070", 2);
      expect(results).toHaveLength(2);
      expect(results[0]?.url).toBe("https://www.example.com/gpu-rtx-4070");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
