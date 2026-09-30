import { describe, expect, test } from "bun:test";
import { canSanction, checkBanExpiry, isBanActive } from "./sanctions";

const NOW = "2026-09-15T12:00:00.000Z";

describe("isBanActive", () => {
  test("permanente y vigente", () => {
    expect(isBanActive({ expires_at: null, lifted_at: null }, NOW)).toBe(true);
    expect(isBanActive({ expires_at: "2026-10-01T00:00:00.000Z", lifted_at: null }, NOW)).toBe(true);
  });

  test("expirada o levantada deja de estar activa", () => {
    expect(isBanActive({ expires_at: "2026-09-01T00:00:00.000Z", lifted_at: null }, NOW)).toBe(false);
    expect(isBanActive({ expires_at: null, lifted_at: "2026-09-10T00:00:00.000Z" }, NOW)).toBe(false);
  });

  test("justo en el instante de expiración ya no está activa", () => {
    expect(isBanActive({ expires_at: NOW, lifted_at: null }, NOW)).toBe(false);
  });
});

describe("canSanction", () => {
  test("sólo sobre quien tiene menos rango", () => {
    expect(canSanction("moderator", "user")).toBe(true);
    expect(canSanction("admin", "moderator")).toBe(true);
    expect(canSanction("moderator", "moderator")).toBe(false);
    expect(canSanction("moderator", "admin")).toBe(false);
    expect(canSanction("admin", "admin")).toBe(false);
    expect(canSanction("user", "user")).toBe(false);
  });
});

describe("checkBanExpiry", () => {
  test("permanente o futura es válida; pasada no", () => {
    expect(checkBanExpiry(undefined, NOW)).toEqual({ ok: true });
    expect(checkBanExpiry("2026-12-01T00:00:00.000Z", NOW)).toEqual({ ok: true });
    expect(checkBanExpiry("2026-01-01T00:00:00.000Z", NOW)).toEqual({ ok: false, reason: "past" });
    expect(checkBanExpiry(NOW, NOW)).toEqual({ ok: false, reason: "past" });
  });
});
