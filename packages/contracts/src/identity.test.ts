import { describe, expect, test } from "bun:test";
import {
  hasRole,
  RESERVED_USERNAMES,
  roleRank,
  UpdateProfileSchema,
  USERNAME_PATTERN,
  UsernameSchema,
} from "./identity";

describe("roles", () => {
  test("jerarquía estricta: cada rol incluye a los anteriores", () => {
    expect(hasRole("admin", "moderator")).toBe(true);
    expect(hasRole("moderator", "moderator")).toBe(true);
    expect(hasRole("user", "moderator")).toBe(false);
    expect(roleRank("admin")).toBeGreaterThan(roleRank("moderator"));
  });
});

describe("username", () => {
  test("acepta 3–24 caracteres [a-z0-9_] y rechaza el resto", () => {
    for (const ok of ["ana", "ana_01", "a".repeat(24), "___", "123"]) expect(USERNAME_PATTERN.test(ok)).toBe(true);
    for (const bad of ["ab", "a".repeat(25), "Ana", "ana perez", "ana.perez", "ñandú", ""]) {
      expect(UsernameSchema.safeParse(bad).success).toBe(false);
    }
  });

  test("los reservados cumplen el formato (si no, la lista no serviría de nada)", () => {
    for (const name of RESERVED_USERNAMES) expect(USERNAME_PATTERN.test(name)).toBe(true);
  });
});

describe("UpdateProfileSchema", () => {
  test("acepta cambios parciales y normaliza la biografía vacía a null", () => {
    expect(UpdateProfileSchema.parse({ bio: "  " })).toEqual({ bio: null });
    expect(UpdateProfileSchema.parse({ displayName: "  Ana  ", lang: "en" })).toEqual({
      displayName: "Ana",
      lang: "en",
    });
  });

  test("rechaza vacío, campos que el usuario no puede tocar y valores fuera de rango", () => {
    expect(UpdateProfileSchema.safeParse({}).success).toBe(false);
    for (const forbidden of [{ role: "admin" }, { avatarUrl: "https://x.cl/a.png" }, { email: "a@b.cl" }]) {
      expect(UpdateProfileSchema.safeParse(forbidden).success).toBe(false);
    }
    expect(UpdateProfileSchema.safeParse({ bio: "x".repeat(281) }).success).toBe(false);
    expect(UpdateProfileSchema.safeParse({ lang: "fr" }).success).toBe(false);
    expect(UpdateProfileSchema.safeParse({ displayName: "x".repeat(61) }).success).toBe(false);
  });
});
