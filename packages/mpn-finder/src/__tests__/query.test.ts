import { describe, expect, test } from "bun:test";
import { cleanSearchQuery } from "../query";

describe("cleanSearchQuery", () => {
  test("saca el sustantivo de categoría y la frase de marketing", () => {
    const out = cleanSearchQuery("Procesador Intel Core i9-14900, hasta 5.8Ghz, LGA1700");
    expect(out).not.toMatch(/procesador/i);
    expect(out).not.toMatch(/hasta/i);
    expect(out).toContain("Intel Core i9-14900");
    expect(out).toContain("LGA1700"); // el socket se conserva: ayuda a la búsqueda
    expect(out).not.toContain(","); // puntuación normalizada
  });

  test("saca 'Memoria RAM' y conserva marca + capacidad + velocidad", () => {
    const out = cleanSearchQuery("Memoria RAM Kingston Fury Beast 16GB DDR4 3200MHz");
    expect(out).not.toMatch(/memoria/i);
    expect(out).toBe("Kingston Fury Beast 16GB DDR4 3200MHz");
  });

  test("NO rompe marcas que contienen un sustantivo de categoría", () => {
    // "cooler" se omite a propósito de la lista de ruido.
    const out = cleanSearchQuery("Cooler Master Hyper 212 Black Edition");
    expect(out).toContain("Cooler Master");
  });

  test("cae al original si la limpieza dejara algo demasiado corto", () => {
    expect(cleanSearchQuery("Procesador")).toBe("Procesador");
  });
});
