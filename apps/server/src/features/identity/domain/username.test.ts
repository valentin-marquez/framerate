import { describe, expect, test } from "bun:test";
import { USERNAME_PATTERN } from "@framerate/contracts";
import { cleanDisplayName, emailLocalPart, generateUsername, normalizeUsername } from "./username";

describe("normalizeUsername", () => {
  test.each([
    ["Ana.Perez", "ana_perez"],
    ["  María José  ", "maria_jose"],
    ["ÑANDÚ", "nandu"],
    ["a--b__c", "a_b_c"],
    ["___x___", "user_x"],
    ["ab", "user_ab"],
    ["", "user"],
    ["!!!", "user"],
  ])("%p → %p", (input, expected) => {
    expect(normalizeUsername(input)).toBe(expected);
  });

  test("siempre cumple el formato final, incluso con entradas largas o raras", () => {
    for (const input of ["a".repeat(80), "🙂🙂🙂🙂", "x y z", "Ünï-cödé_Ñ", "1", "_-_-_", `${"a".repeat(23)}-b`]) {
      const result = normalizeUsername(input);
      expect(USERNAME_PATTERN.test(result)).toBe(true);
    }
  });
});

describe("generateUsername", () => {
  const never = async () => false;

  test("usa el candidato normalizado si está libre", async () => {
    expect(await generateUsername("Ana.Perez", never)).toBe("ana_perez");
  });

  test("agrega sufijo si está tomado, y sigue probando si el sufijo también lo está", async () => {
    const taken = new Set(["ana", "ana_1000"]);
    const isTaken = async (u: string) => taken.has(u);
    // random() = 0 → siempre 1000 primero; luego 1001 con random distinto.
    const values = [0, 0.0002];
    const random = () => values.shift() ?? 0.5;
    expect(await generateUsername("Ana", isTaken, random)).toBe("ana_1001");
  });

  test("nunca entrega un handle reservado", async () => {
    for (const reserved of ["admin", "Admin", "root", "Soporte", "framerate"]) {
      const result = await generateUsername(reserved, never, () => 0);
      expect(result).not.toBe(normalizeUsername(reserved));
      expect(USERNAME_PATTERN.test(result)).toBe(true);
    }
  });

  test("el sufijo cabe dentro de 24 caracteres aunque la base sea larga", async () => {
    const long = "a".repeat(40);
    const taken = new Set([normalizeUsername(long)]);
    const result = await generateUsername(
      long,
      async (u) => taken.has(u),
      () => 0,
    );
    expect(result.length).toBeLessThanOrEqual(24);
    expect(result.endsWith("_1000")).toBe(true);
  });

  test("falla con un error claro si no encuentra ninguno libre", async () => {
    await expect(
      generateUsername(
        "ana",
        async () => true,
        () => 0,
      ),
    ).rejects.toThrow("único");
  });
});

describe("nombres", () => {
  test("cleanDisplayName colapsa espacios y acota el largo", () => {
    expect(cleanDisplayName("  Ana \n  Pérez ")).toBe("Ana Pérez");
    expect(cleanDisplayName("x".repeat(100))).toHaveLength(60);
    expect(cleanDisplayName(null)).toBe("");
  });

  test("emailLocalPart", () => {
    expect(emailLocalPart("ana.perez@gmail.com")).toBe("ana.perez");
    expect(emailLocalPart(undefined)).toBe("");
  });
});
