/**
 * Tests de `SupabaseMpnCache`. El cliente Supabase se mockea con un stub
 * encadenable — NO se toca una BD real.
 */

import { describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MpnResult } from "../../types";
import { SupabaseMpnCache } from "../mpn-cache";

/** Un `MpnResult` de ejemplo para hits de caché. */
const sampleResult: MpnResult = {
  query: "rtx 4070 super",
  mpns: [{ value: "RTX4070S-O12G", variant: "retail", confidence: 0.9 }],
  canonicalName: "ASUS Dual GeForce RTX 4070 SUPER",
  notes: null,
  source: "duckduckgo+llm",
};

/** Forma de una fila de `mpn_resolutions` tal como la devuelve el select. */
interface Row {
  query_hash: string;
  query: string;
  result: unknown;
  expires_at: string | null;
}

/** Captura lo que `set` intentó upsertear, para inspeccionarlo en los tests. */
interface UpsertCapture {
  payload: Record<string, unknown> | null;
  options: Record<string, unknown> | null;
}

/**
 * Construye un stub de `SupabaseClient` con un builder encadenable.
 *
 * @param opts.selectData  Fila a devolver desde `maybeSingle()` (o `null`).
 * @param opts.selectError Error a devolver desde `maybeSingle()`.
 * @param opts.upsertError Error a devolver desde `upsert()`.
 * @param opts.capture     Objeto donde se vuelca el payload del `upsert`.
 */
function makeStubClient(opts: {
  selectData?: Row | null;
  selectError?: { message: string } | null;
  upsertError?: { message: string } | null;
  capture?: UpsertCapture;
}): SupabaseClient {
  const builder = {
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    async maybeSingle() {
      return {
        data: opts.selectData ?? null,
        error: opts.selectError ?? null,
      };
    },
    async upsert(payload: Record<string, unknown>, options: Record<string, unknown>) {
      if (opts.capture) {
        opts.capture.payload = payload;
        opts.capture.options = options;
      }
      return { data: null, error: opts.upsertError ?? null };
    },
  };

  return {
    from() {
      return builder;
    },
  } as unknown as SupabaseClient;
}

/** Cliente que lanza en `from()` — simula un fallo total del backend. */
function makeThrowingClient(): SupabaseClient {
  return {
    from() {
      throw new Error("conexión caída");
    },
  } as unknown as SupabaseClient;
}

describe("SupabaseMpnCache", () => {
  describe("get", () => {
    it("devuelve el MpnResult en un cache hit (sin expiración)", async () => {
      const client = makeStubClient({
        selectData: {
          query_hash: "abc",
          query: "rtx 4070 super",
          result: sampleResult,
          expires_at: null,
        },
      });
      const cache = new SupabaseMpnCache(client);

      const got = await cache.get("RTX 4070 Super");
      expect(got).toEqual(sampleResult);
    });

    it("devuelve el MpnResult cuando expires_at es futuro", async () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      const client = makeStubClient({
        selectData: {
          query_hash: "abc",
          query: "rtx 4070 super",
          result: sampleResult,
          expires_at: future,
        },
      });
      const cache = new SupabaseMpnCache(client);

      expect(await cache.get("rtx 4070 super")).toEqual(sampleResult);
    });

    it("devuelve null en un cache miss (fila inexistente)", async () => {
      const client = makeStubClient({ selectData: null });
      const cache = new SupabaseMpnCache(client);

      expect(await cache.get("producto desconocido")).toBeNull();
    });

    it("devuelve null cuando la fila está expirada", async () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      const client = makeStubClient({
        selectData: {
          query_hash: "abc",
          query: "rtx 4070 super",
          result: sampleResult,
          expires_at: past,
        },
      });
      const cache = new SupabaseMpnCache(client);

      expect(await cache.get("rtx 4070 super")).toBeNull();
    });

    it("devuelve null ante un error del backend (tabla inexistente)", async () => {
      const client = makeStubClient({
        selectError: { message: 'relation "mpn_resolutions" does not exist' },
      });
      const cache = new SupabaseMpnCache(client);

      expect(await cache.get("rtx 4070 super")).toBeNull();
    });

    it("no lanza y devuelve null si el cliente revienta", async () => {
      const cache = new SupabaseMpnCache(makeThrowingClient());
      expect(await cache.get("rtx 4070 super")).toBeNull();
    });
  });

  describe("set", () => {
    it("upsertea con onConflict query_hash y la query normalizada", async () => {
      const capture: UpsertCapture = { payload: null, options: null };
      const client = makeStubClient({ capture });
      const cache = new SupabaseMpnCache(client);

      await cache.set("  RTX 4070 Super  ", sampleResult);

      expect(capture.payload).not.toBeNull();
      expect(capture.payload?.query).toBe("rtx 4070 super");
      expect(capture.payload?.result).toEqual(sampleResult);
      expect(typeof capture.payload?.query_hash).toBe("string");
      expect(capture.options?.onConflict).toBe("query_hash");
    });

    it("escribe un expires_at coherente con el TTL configurado", async () => {
      const capture: UpsertCapture = { payload: null, options: null };
      const client = makeStubClient({ capture });
      const ttlMs = 60 * 60 * 1000; // 1 hora
      const cache = new SupabaseMpnCache(client, ttlMs);

      const before = Date.now();
      await cache.set("rtx 4070 super", sampleResult);
      const after = Date.now();

      const expiresAt = new Date(capture.payload?.expires_at as string).getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(before + ttlMs);
      expect(expiresAt).toBeLessThanOrEqual(after + ttlMs);
    });

    it("no lanza ante un error del backend", async () => {
      const client = makeStubClient({
        upsertError: { message: 'relation "mpn_resolutions" does not exist' },
      });
      const cache = new SupabaseMpnCache(client);

      await expect(cache.set("rtx 4070 super", sampleResult)).resolves.toBeUndefined();
    });

    it("no lanza si el cliente revienta", async () => {
      const cache = new SupabaseMpnCache(makeThrowingClient());
      await expect(cache.set("rtx 4070 super", sampleResult)).resolves.toBeUndefined();
    });
  });
});
