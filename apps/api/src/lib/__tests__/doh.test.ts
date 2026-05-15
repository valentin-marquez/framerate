import { afterEach, describe, expect, test } from "bun:test";
import { verifyTxtRecord } from "../doh";

const originalFetch = globalThis.fetch;

interface DohJson {
  Status: number;
  Answer?: Array<{ name: string; type: number; TTL: number; data: string }>;
}

function mockFetch(responses: Record<string, DohJson | "error">) {
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    const u = url.toString();
    const provider = u.startsWith("https://cloudflare-dns.com") ? "cf" : "google";
    const resp = responses[provider];
    if (resp === "error") throw new Error("network down");
    return new Response(JSON.stringify(resp), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("verifyTxtRecord", () => {
  const NAME = "_framerate-verify.example.cl";
  const VALUE = "framerate-verify=v1:abc";

  test("happy path: both resolvers match", async () => {
    mockFetch({
      cf: { Status: 0, Answer: [{ name: NAME, type: 16, TTL: 60, data: `"${VALUE}"` }] },
      google: { Status: 0, Answer: [{ name: NAME, type: 16, TTL: 60, data: `"${VALUE}"` }] },
    });
    const res = await verifyTxtRecord(NAME, VALUE);
    expect(res.matched).toBe(true);
    expect(res.status).toBe("verified");
  });

  test("NXDOMAIN on both = pending", async () => {
    mockFetch({ cf: { Status: 3 }, google: { Status: 3 } });
    const res = await verifyTxtRecord(NAME, VALUE);
    expect(res.matched).toBe(false);
    expect(res.status).toBe("pending");
  });

  test("only one resolver matches = pending (still propagating)", async () => {
    mockFetch({
      cf: { Status: 0, Answer: [{ name: NAME, type: 16, TTL: 60, data: `"${VALUE}"` }] },
      google: { Status: 3 },
    });
    const res = await verifyTxtRecord(NAME, VALUE);
    expect(res.matched).toBe(false);
    expect(res.status).toBe("pending");
  });

  test("records present but wrong value = mismatch", async () => {
    mockFetch({
      cf: { Status: 0, Answer: [{ name: NAME, type: 16, TTL: 60, data: '"framerate-verify=v1:other"' }] },
      google: { Status: 0, Answer: [{ name: NAME, type: 16, TTL: 60, data: '"framerate-verify=v1:other"' }] },
    });
    const res = await verifyTxtRecord(NAME, VALUE);
    expect(res.matched).toBe(false);
    expect(res.status).toBe("mismatch");
  });

  test("handles multi-chunk TXT", async () => {
    mockFetch({
      cf: { Status: 0, Answer: [{ name: NAME, type: 16, TTL: 60, data: `"framerate-verify=" "v1:abc"` }] },
      google: { Status: 0, Answer: [{ name: NAME, type: 16, TTL: 60, data: `"framerate-verify=v1:abc"` }] },
    });
    const res = await verifyTxtRecord(NAME, VALUE);
    expect(res.matched).toBe(true);
  });

  test("network error on one resolver = error/pending", async () => {
    mockFetch({ cf: "error", google: { Status: 3 } });
    const res = await verifyTxtRecord(NAME, VALUE);
    expect(res.matched).toBe(false);
    // cf null + google NXDOMAIN: neither matches, no records, falls to error
    expect(["pending", "error"]).toContain(res.status);
  });
});
