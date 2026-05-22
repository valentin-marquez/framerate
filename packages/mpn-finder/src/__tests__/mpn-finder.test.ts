import { describe, expect, test } from "bun:test";
import { MpnFinder } from "../index";
import type { LlmExtractor, MpnCache, MpnResult, SearchProvider, SearchResult } from "../types";

// Stubs de las 3 dependencias del orquestador.

function stubProvider(name: string, results: SearchResult[]): SearchProvider {
  return { name, search: async () => results };
}

function stubExtractor(mpns: MpnResult["mpns"]): LlmExtractor & { calls: number } {
  const ex = {
    calls: 0,
    async extract(query: string): Promise<MpnResult> {
      ex.calls++;
      return { query, mpns, canonicalName: null, notes: null, source: "llm" };
    },
  };
  return ex;
}

function stubCache(initial?: MpnResult): MpnCache & { sets: MpnResult[] } {
  const store = new Map<string, MpnResult>();
  if (initial) store.set(initial.query.trim(), initial);
  const cache = {
    sets: [] as MpnResult[],
    async get(query: string) {
      return store.get(query.trim()) ?? null;
    },
    async set(query: string, result: MpnResult) {
      store.set(query.trim(), result);
      cache.sets.push(result);
    },
  };
  return cache;
}

const RESULT: SearchResult = { title: "Intel Core i9-14900 BX8071514900", snippet: "MPN BX8071514900", url: "u" };
const MPNS = [{ value: "BX8071514900", variant: "boxed" as const, confidence: 0.9 }];

describe("MpnFinder.findMpn", () => {
  test("cache hit: devuelve lo cacheado con source 'cache', sin tocar el extractor", async () => {
    const extractor = stubExtractor(MPNS);
    const finder = new MpnFinder({
      providers: [stubProvider("ddg", [RESULT])],
      extractor,
      cache: stubCache({ query: "i9-14900", mpns: MPNS, canonicalName: null, notes: null, source: "llm" }),
    });

    const out = await finder.findMpn("i9-14900");
    expect(out.source).toBe("cache");
    expect(out.mpns).toHaveLength(1);
    expect(extractor.calls).toBe(0);
  });

  test("cache miss: busca, extrae y cachea el resultado", async () => {
    const extractor = stubExtractor(MPNS);
    const cache = stubCache();
    const finder = new MpnFinder({ providers: [stubProvider("ddg", [RESULT])], extractor, cache });

    const out = await finder.findMpn("Intel Core i9-14900");
    expect(extractor.calls).toBe(1);
    expect(out.source).toBe("ddg+llm");
    expect(out.mpns[0].value).toBe("BX8071514900");
    expect(cache.sets).toHaveLength(1);
  });

  test("cae al siguiente proveedor si el primero no devuelve resultados", async () => {
    const extractor = stubExtractor(MPNS);
    const finder = new MpnFinder({
      providers: [stubProvider("vacio", []), stubProvider("bueno", [RESULT])],
      extractor,
      cache: stubCache(),
    });

    const out = await finder.findMpn("algo");
    expect(out.source).toBe("bueno+llm");
    expect(extractor.calls).toBe(1);
  });

  test("ningún proveedor con resultados: resultado vacío, sin llamar al extractor", async () => {
    const extractor = stubExtractor(MPNS);
    const finder = new MpnFinder({ providers: [stubProvider("vacio", [])], extractor, cache: stubCache() });

    const out = await finder.findMpn("inexistente");
    expect(out.mpns).toHaveLength(0);
    expect(out.source).toBe("none");
    expect(extractor.calls).toBe(0);
  });

  test("query vacía: resultado vacío", async () => {
    const finder = new MpnFinder({
      providers: [stubProvider("ddg", [RESULT])],
      extractor: stubExtractor(MPNS),
      cache: stubCache(),
    });
    const out = await finder.findMpn("   ");
    expect(out.mpns).toHaveLength(0);
  });
});
