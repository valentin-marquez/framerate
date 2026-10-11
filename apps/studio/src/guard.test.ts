import { expect, test } from "bun:test";
import { allowed } from "./guard";

const req = (headers: Record<string, string>) =>
  new Request("http://127.0.0.1:4983/api/query", { method: "POST", headers });
const json = { "content-type": "application/json" };

test("acepta la propia SPA", () => {
  expect(allowed(req({ ...json, host: "127.0.0.1:4983", origin: "http://127.0.0.1:4983" }), 4983)).toBe(true);
  expect(allowed(req({ ...json, host: "localhost:4983" }), 4983)).toBe(true);
});

test("rechaza otro origen (CSRF)", () => {
  expect(allowed(req({ ...json, host: "127.0.0.1:4983", origin: "https://evil.example" }), 4983)).toBe(false);
});

test("rechaza un Host ajeno (DNS rebinding)", () => {
  expect(allowed(req({ ...json, host: "evil.example:4983" }), 4983)).toBe(false);
});

test("rechaza cuerpos que no son JSON (evitan el preflight)", () => {
  expect(allowed(req({ "content-type": "text/plain", host: "127.0.0.1:4983" }), 4983)).toBe(false);
});
