import { describe, expect, test } from "bun:test";
import { generateToken, normalizeDomain, txtRecordName, txtRecordValue } from "../domain";

describe("normalizeDomain", () => {
  test("strips protocol, www, trailing slash, port", () => {
    expect(normalizeDomain("https://www.pcexpress.cl/")).toBe("pcexpress.cl");
    expect(normalizeDomain("HTTP://Pcexpress.CL")).toBe("pcexpress.cl");
    expect(normalizeDomain("pcexpress.cl:443")).toBe("pcexpress.cl");
    expect(normalizeDomain("pcexpress.cl.")).toBe("pcexpress.cl");
  });

  test("accepts multi-label TLDs", () => {
    expect(normalizeDomain("shop.example.co.uk")).toBe("shop.example.co.uk");
  });

  test("rejects invalid hosts", () => {
    expect(normalizeDomain("not a domain")).toBeNull();
    expect(normalizeDomain("--foo--.cl")).toBeNull();
    expect(normalizeDomain("foo")).toBeNull();
    expect(normalizeDomain("")).toBeNull();
  });
});

describe("generateToken", () => {
  test("returns v1: prefixed 32-hex string", () => {
    const t = generateToken();
    expect(t).toMatch(/^v1:[0-9a-f]{32}$/);
  });
  test("randomness: two tokens differ", () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe("txt helpers", () => {
  test("name + value composition", () => {
    expect(txtRecordName("pcexpress.cl")).toBe("_framerate-verify.pcexpress.cl");
    expect(txtRecordValue("v1:abc")).toBe("framerate-verify=v1:abc");
  });
});
