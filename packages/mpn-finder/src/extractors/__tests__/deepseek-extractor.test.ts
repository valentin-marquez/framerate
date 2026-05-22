/**
 * Tests del `DeepSeekExtractor`. El cliente OpenAI se mockea por inyección —
 * no se hacen llamadas reales a DeepSeek.
 */

import { describe, expect, it } from "bun:test";
import type OpenAI from "openai";
import type { SearchResult } from "../../types";
import { DeepSeekExtractor } from "../deepseek-extractor";

/**
 * Crea un cliente OpenAI falso cuyo `chat.completions.create` devuelve el
 * `content` indicado (o lanza el error indicado).
 */
function fakeClient(opts: { content?: string; error?: unknown }): OpenAI {
  return {
    chat: {
      completions: {
        create: async () => {
          if (opts.error) throw opts.error;
          return {
            choices: [{ message: { content: opts.content ?? "" } }],
          };
        },
      },
    },
  } as unknown as OpenAI;
}

const SAMPLE_RESULTS: SearchResult[] = [
  {
    title: "Intel Core i7-12700K BX8071512700K Procesador",
    snippet: "Procesador Intel Core i7-12700K, modelo BX8071512700K, socket LGA1700.",
    url: "https://example.com/i7-12700k",
  },
  {
    title: "Intel Core i7-12700K en caja",
    snippet: "Versión boxed retail con disipador incluido.",
    url: "https://example.com/listing",
  },
];

describe("DeepSeekExtractor", () => {
  it("extrae un MPN presente en los snippets (caso feliz)", async () => {
    const client = fakeClient({
      content: JSON.stringify({
        mpns: [{ value: "BX8071512700K", variant: "boxed", confidence: 0.95 }],
        product_canonical_name: "Intel Core i7-12700K",
        notes: null,
      }),
    });
    const extractor = new DeepSeekExtractor({ client });

    const result = await extractor.extract("i7 12700k", SAMPLE_RESULTS);

    expect(result.mpns).toHaveLength(1);
    expect(result.mpns[0]?.value).toBe("BX8071512700K");
    expect(result.mpns[0]?.variant).toBe("boxed");
    expect(result.mpns[0]?.confidence).toBe(0.95);
    expect(result.canonicalName).toBe("Intel Core i7-12700K");
    expect(result.source).toBe("llm");
    expect(result.query).toBe("i7 12700k");
  });

  it("hace grounding aunque el MPN tenga distinto formato de guiones", async () => {
    // El snippet tiene "BX8071512700K"; el LLM lo devuelve con guiones.
    const client = fakeClient({
      content: JSON.stringify({
        mpns: [{ value: "BX-8071512700K", variant: "retail", confidence: 0.8 }],
        product_canonical_name: null,
        notes: null,
      }),
    });
    const extractor = new DeepSeekExtractor({ client });

    const result = await extractor.extract("i7 12700k", SAMPLE_RESULTS);

    expect(result.mpns).toHaveLength(1);
    expect(result.mpns[0]?.value).toBe("BX-8071512700K");
  });

  it("ordena los MPN por confianza descendente", async () => {
    const results: SearchResult[] = [
      {
        title: "AMD Ryzen 5 5600X 100-100000065BOX y 100-000000065 tray",
        snippet: "Disponible como 100-100000065BOX (boxed) o 100-000000065 (tray).",
        url: "https://example.com/ryzen",
      },
    ];
    const client = fakeClient({
      content: JSON.stringify({
        mpns: [
          { value: "100-000000065", variant: "tray", confidence: 0.6 },
          { value: "100-100000065BOX", variant: "boxed", confidence: 0.9 },
        ],
        product_canonical_name: "AMD Ryzen 5 5600X",
        notes: null,
      }),
    });
    const extractor = new DeepSeekExtractor({ client });

    const result = await extractor.extract("ryzen 5 5600x", results);

    expect(result.mpns.map((m) => m.value)).toEqual(["100-100000065BOX", "100-000000065"]);
  });

  it("descarta un MPN alucinado que no aparece en los snippets (grounding)", async () => {
    const client = fakeClient({
      content: JSON.stringify({
        mpns: [
          { value: "BX8071512700K", variant: "boxed", confidence: 0.95 },
          // Este código NO está en ningún snippet → alucinación.
          { value: "CM8071504555828", variant: "tray", confidence: 0.7 },
        ],
        product_canonical_name: "Intel Core i7-12700K",
        notes: null,
      }),
    });
    const extractor = new DeepSeekExtractor({ client });

    const result = await extractor.extract("i7 12700k", SAMPLE_RESULTS);

    expect(result.mpns).toHaveLength(1);
    expect(result.mpns[0]?.value).toBe("BX8071512700K");
    expect(result.notes).toContain("grounding");
  });

  it("devuelve resultado vacío si TODOS los MPN son alucinaciones", async () => {
    const client = fakeClient({
      content: JSON.stringify({
        mpns: [{ value: "FAKE9999999", variant: "unknown", confidence: 0.5 }],
        product_canonical_name: null,
        notes: null,
      }),
    });
    const extractor = new DeepSeekExtractor({ client });

    const result = await extractor.extract("i7 12700k", SAMPLE_RESULTS);

    expect(result.mpns).toHaveLength(0);
    expect(result.source).toBe("none");
    expect(result.notes).toContain("grounding");
  });

  it("devuelve resultado vacío si el JSON es inválido", async () => {
    const client = fakeClient({ content: "esto no es json {{{" });
    const extractor = new DeepSeekExtractor({ client });

    const result = await extractor.extract("i7 12700k", SAMPLE_RESULTS);

    expect(result.mpns).toHaveLength(0);
    expect(result.source).toBe("none");
  });

  it("devuelve resultado vacío si el JSON no cumple el esquema", async () => {
    // `mpns` debería ser un array; acá es un string.
    const client = fakeClient({
      content: JSON.stringify({ mpns: "nope", product_canonical_name: null }),
    });
    const extractor = new DeepSeekExtractor({ client });

    const result = await extractor.extract("i7 12700k", SAMPLE_RESULTS);

    expect(result.mpns).toHaveLength(0);
    expect(result.source).toBe("none");
  });

  it("devuelve resultado vacío si no hay resultados de búsqueda", async () => {
    // No debería llamar al cliente; si lo hiciera, este content provocaría fallo.
    const client = fakeClient({ content: "{}" });
    const extractor = new DeepSeekExtractor({ client });

    const result = await extractor.extract("i7 12700k", []);

    expect(result.mpns).toHaveLength(0);
    expect(result.source).toBe("none");
    expect(result.query).toBe("i7 12700k");
  });

  it("devuelve resultado vacío si el cliente lanza un error", async () => {
    const client = fakeClient({ error: new Error("DeepSeek 500") });
    const extractor = new DeepSeekExtractor({ client });

    const result = await extractor.extract("i7 12700k", SAMPLE_RESULTS);

    expect(result.mpns).toHaveLength(0);
    expect(result.source).toBe("none");
  });

  it("devuelve resultado vacío si no hay API key ni cliente inyectado", async () => {
    const prev = process.env.DEEPSEEK_API_KEY;
    // `delete` quita la var de verdad; asignar `undefined` la dejaría como el
    // string "undefined" (truthy) y el constructor crearía un cliente real.
    delete process.env.DEEPSEEK_API_KEY;
    try {
      // Sin API key → `extract` debe cortar antes de tocar la red.
      const extractor = new DeepSeekExtractor({ apiKey: undefined });
      const result = await extractor.extract("i7 12700k", SAMPLE_RESULTS);
      expect(result.mpns).toHaveLength(0);
      expect(result.source).toBe("none");
    } finally {
      if (prev !== undefined) process.env.DEEPSEEK_API_KEY = prev;
    }
  });
});
