import { expect, test } from "bun:test";
import { brandFor } from "../scripts/rebrand";

const row = (title: string, declared: string | null = null) => ({
  listing_id: 1,
  category: "mouse" as const,
  declared,
  title,
});

test("la marca sale del título o de lo que declara la tienda", () => {
  expect(brandFor(row("Mouse Logitech M170"))).toBe("Logitech");
  expect(brandFor(row("Mouse Óptico M170", "Razer"))).toBe("Razer");
});

test("sin marca reconocible, no se inventa una", () => {
  expect(brandFor(row("Mouse Óptico USB Negro"))).toBeNull();
  expect(brandFor(row("Mouse Óptico USB Negro", "Genérico"))).toBeNull();
});
