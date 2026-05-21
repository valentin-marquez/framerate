import { afterEach, describe, expect, test } from "bun:test";
import { detectDnsProvider } from "../dns-provider";

const originalFetch = globalThis.fetch;

interface DohJson {
  Status: number;
  Answer?: Array<{ name: string; type: number; TTL: number; data: string }>;
}

function nsAnswer(domain: string, ns: string[]): DohJson {
  return {
    Status: 0,
    Answer: ns.map((n) => ({ name: domain, type: 2, TTL: 3600, data: n })),
  };
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

describe("detectDnsProvider", () => {
  test("matches Cloudflare from NS records", async () => {
    const ans = nsAnswer("example.cl", ["lex.ns.cloudflare.com.", "mira.ns.cloudflare.com."]);
    mockFetch({ cf: ans, google: ans });
    const res = await detectDnsProvider("example.cl");
    expect(res.provider?.id).toBe("cloudflare");
    expect(res.nameservers).toContain("lex.ns.cloudflare.com");
  });

  test("matches AWS Route 53", async () => {
    const ans = nsAnswer("example.com", [
      "ns-1234.awsdns-12.org.",
      "ns-567.awsdns-08.net.",
      "ns-89.awsdns-01.com.",
      "ns-2000.awsdns-99.co.uk.",
    ]);
    mockFetch({ cf: ans, google: ans });
    const res = await detectDnsProvider("example.com");
    expect(res.provider?.id).toBe("route53");
  });

  test("matches Google Cloud DNS", async () => {
    const ans = nsAnswer("example.com", ["ns-cloud-a1.googledomains.com.", "ns-cloud-a2.googledomains.com."]);
    mockFetch({ cf: ans, google: ans });
    const res = await detectDnsProvider("example.com");
    expect(res.provider?.id).toBe("gcdns");
  });

  test("matches Vercel", async () => {
    const ans = nsAnswer("example.com", ["ns1.vercel-dns.com.", "ns2.vercel-dns.com."]);
    mockFetch({ cf: ans, google: ans });
    const res = await detectDnsProvider("example.com");
    expect(res.provider?.id).toBe("vercel");
  });

  test("matches DigitalOcean", async () => {
    const ans = nsAnswer("example.com", ["ns1.digitalocean.com.", "ns2.digitalocean.com.", "ns3.digitalocean.com."]);
    mockFetch({ cf: ans, google: ans });
    const res = await detectDnsProvider("example.com");
    expect(res.provider?.id).toBe("digitalocean");
  });

  test("matches GoDaddy", async () => {
    const ans = nsAnswer("example.com", ["ns01.domaincontrol.com.", "ns02.domaincontrol.com."]);
    mockFetch({ cf: ans, google: ans });
    const res = await detectDnsProvider("example.com");
    expect(res.provider?.id).toBe("godaddy");
  });

  test("matches Namecheap", async () => {
    const ans = nsAnswer("example.com", ["dns1.registrar-servers.com.", "dns2.registrar-servers.com."]);
    mockFetch({ cf: ans, google: ans });
    const res = await detectDnsProvider("example.com");
    expect(res.provider?.id).toBe("namecheap");
  });

  test("matches Hostinger", async () => {
    const ans = nsAnswer("example.com", ["ns1.dns-parking.com.", "ns2.hostinger.com."]);
    mockFetch({ cf: ans, google: ans });
    const res = await detectDnsProvider("example.com");
    expect(res.provider?.id).toBe("hostinger");
  });

  test("matches Azure DNS", async () => {
    const ans = nsAnswer("example.com", ["ns1-01.azure-dns.com.", "ns2-01.azure-dns.net."]);
    mockFetch({ cf: ans, google: ans });
    const res = await detectDnsProvider("example.com");
    expect(res.provider?.id).toBe("azure");
  });

  test("matches NIC.cl", async () => {
    const ans = nsAnswer("example.cl", ["ns.nic.cl.", "tato.nic.cl."]);
    mockFetch({ cf: ans, google: ans });
    const res = await detectDnsProvider("example.cl");
    expect(res.provider?.id).toBe("nic_cl");
  });

  test("matches HostingPlus", async () => {
    const ans = nsAnswer("tienda.cl", ["ns1.hostingplus.cl.", "ns2.hostingplus.cl."]);
    mockFetch({ cf: ans, google: ans });
    const res = await detectDnsProvider("tienda.cl");
    expect(res.provider?.id).toBe("hostingplus_cl");
  });

  test("matches Sered", async () => {
    const ans = nsAnswer("tienda.cl", ["ns1.sered.net.", "ns2.sered.net."]);
    mockFetch({ cf: ans, google: ans });
    const res = await detectDnsProvider("tienda.cl");
    expect(res.provider?.id).toBe("sered_cl");
  });

  test("matches BlueHosting", async () => {
    const ans = nsAnswer("tienda.cl", ["ns1.bluehosting.cl.", "ns2.bluehosting.cl."]);
    mockFetch({ cf: ans, google: ans });
    const res = await detectDnsProvider("tienda.cl");
    expect(res.provider?.id).toBe("bluehosting_cl");
  });

  test("unknown provider returns null but keeps nameservers", async () => {
    const ans = nsAnswer("example.com", ["ns1.weird-provider.example.", "ns2.weird-provider.example."]);
    mockFetch({ cf: ans, google: ans });
    const res = await detectDnsProvider("example.com");
    expect(res.provider).toBeNull();
    expect(res.nameservers).toHaveLength(2);
  });

  test("NXDOMAIN on both = provider null, no nameservers", async () => {
    mockFetch({ cf: { Status: 3 }, google: { Status: 3 } });
    const res = await detectDnsProvider("nope.invalid");
    expect(res.provider).toBeNull();
    expect(res.nameservers).toEqual([]);
  });

  test("network error on both = null, no throw", async () => {
    mockFetch({ cf: "error", google: "error" });
    const res = await detectDnsProvider("example.com");
    expect(res.provider).toBeNull();
    expect(res.nameservers).toEqual([]);
  });

  test("dedupes NS across resolvers and sorts", async () => {
    const ans1 = nsAnswer("example.cl", ["mira.ns.cloudflare.com.", "lex.ns.cloudflare.com."]);
    const ans2 = nsAnswer("example.cl", ["lex.ns.cloudflare.com.", "mira.ns.cloudflare.com."]);
    mockFetch({ cf: ans1, google: ans2 });
    const res = await detectDnsProvider("example.cl");
    expect(res.nameservers).toEqual(["lex.ns.cloudflare.com", "mira.ns.cloudflare.com"]);
  });

  test("empty domain returns null without fetching", async () => {
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("{}");
    }) as unknown as typeof fetch;
    const res = await detectDnsProvider("");
    expect(res.provider).toBeNull();
    expect(res.nameservers).toEqual([]);
    expect(fetched).toBe(false);
  });
});
