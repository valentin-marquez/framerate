import { describe, expect, test } from "bun:test";
import { collapseWhitespace, decodeEntities, fold, slugify, stripHtml } from "./text";

describe("texto", () => {
  test("fold: minúsculas y sin tildes", () => {
    expect(fold("Tarjeta GRÁFICA Ñandú")).toBe("tarjeta grafica nandu");
  });

  test("slugify: ASCII con guiones, sin extremos sueltos y con largo acotado", () => {
    expect(slugify("  ASUS Dual RTX 4070 SUPER — 12GB!  ")).toBe("asus-dual-rtx-4070-super-12gb");
    expect(slugify("Memoria RAM 32GB (2x16GB) DDR5")).toBe("memoria-ram-32gb-2x16gb-ddr5");
    const long = slugify("a".repeat(200));
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith("-")).toBe(false);
    expect(slugify("¡¡¡")).toBe("");
  });

  test("decodeEntities: nombradas y numéricas, sin tocar las desconocidas", () => {
    expect(decodeEntities("AMD &amp; Intel &quot;OC&quot; &#8211; &#233; &desconocida;")).toBe(
      'AMD & Intel "OC" - é &desconocida;',
    );
  });

  test("stripHtml: quita etiquetas, decodifica y colapsa espacios", () => {
    expect(stripHtml("<p>Fuente <b>850W</b>&nbsp;80&nbsp;Plus</p>\n<span>  Gold </span>")).toBe(
      "Fuente 850W 80 Plus Gold",
    );
  });

  test("collapseWhitespace", () => {
    expect(collapseWhitespace("  a \n\t b   c ")).toBe("a b c");
  });
});
