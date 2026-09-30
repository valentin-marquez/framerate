import { describe, expect, test } from "bun:test";
import { checkTxt, claimTxtName, claimTxtValue, detectDnsProvider, providerFromNameservers, txtRecords } from "./dns";

const answer = (...txt: string[]) => ({ Status: 0, Answer: txt.map((data) => ({ type: 16, data })) });
const nx = { Status: 3 };

/** Fetch falso: responde según el resolver (host) que se consulta. */
const resolvers = (cloudflare: object | "down", google: object | "down") => async (url: string) => {
  const reply = url.includes("cloudflare") ? cloudflare : google;
  if (reply === "down") throw new Error("timeout");
  return new Response(JSON.stringify(reply));
};

const expected = claimTxtValue("abc");

describe("checkTxt", () => {
  test("verificado sólo si los dos resolvers ven el valor", async () => {
    const ok = answer(`"${expected}"`);
    expect((await checkTxt("x", expected, resolvers(ok, ok))).status).toBe("verified");
    expect((await checkTxt("x", expected, resolvers(ok, nx))).status).toBe("pending");
  });

  test("propagando (NXDOMAIN en ambos) es pending y conclusivo", async () => {
    const check = await checkTxt("x", expected, resolvers(nx, nx));
    expect(check).toMatchObject({ status: "pending", conclusive: true, found: [] });
  });

  test("hay TXT pero con otro valor → mismatch, y lo devuelve", async () => {
    const other = answer('"google-site-verification=zzz"');
    const check = await checkTxt("x", expected, resolvers(other, other));
    expect(check).toMatchObject({ status: "mismatch", found: ["google-site-verification=zzz"] });
  });

  test("un resolver caído no es evidencia: error y no conclusivo", async () => {
    const check = await checkTxt("x", expected, resolvers("down", nx));
    expect(check).toMatchObject({ status: "error", conclusive: false });
  });

  test("une los trozos de un TXT largo", () => {
    expect(txtRecords(answer('"framerate-verify=" "v1:abc"'))).toEqual(["framerate-verify=v1:abc"]);
  });
});

describe("proveedor de DNS", () => {
  test("se reconoce por nameserver", async () => {
    expect(providerFromNameservers(["lara.ns.cloudflare.com"])).toBe("cloudflare");
    expect(providerFromNameservers(["ns-12.awsdns-01.com"])).toBe("route53");
    expect(providerFromNameservers(["ns1.desconocido.net"])).toBeNull();
    const ns = { Status: 0, Answer: [{ type: 2, data: "ns1.domaincontrol.com." }] };
    expect(await detectDnsProvider("tienda.cl", resolvers(ns, ns))).toEqual({
      provider: "godaddy",
      nameservers: ["ns1.domaincontrol.com"],
    });
  });
});

test("nombre y valor del registro", () => {
  expect(claimTxtName("tienda.cl")).toBe("_framerate-verify.tienda.cl");
  expect(expected).toBe("framerate-verify=v1:abc");
});
