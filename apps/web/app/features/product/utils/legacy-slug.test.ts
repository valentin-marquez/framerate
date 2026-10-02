import { describe, expect, test } from "bun:test";
import { legacySlug } from "./legacy-slug";

describe("legacySlug", () => {
  test("quita el sufijo numérico del sistema anterior y arma la búsqueda con las primeras palabras", () => {
    expect(legacySlug("kingston-16gb-ddr5-5600-mt-s-kvr56s46bs8-16--1768446227502")).toEqual({
      base: "kingston-16gb-ddr5-5600-mt-s-kvr56s46bs8-16",
      search: "kingston 16gb ddr5 5600",
    });
  });

  test("un slug de hoy, o con guiones dobles que no cierran en número, no es del sistema anterior", () => {
    expect(legacySlug("kingston-16gb-ddr5")).toBeNull();
    expect(legacySlug("asus--rog-strix")).toBeNull();
    expect(legacySlug("producto--123abc")).toBeNull();
    expect(legacySlug("--123")).toBeNull();
  });
});
