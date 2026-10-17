import { describe, expect, test } from "bun:test";
import { collapseWhitespace, decodeEntities, fold, htmlLines, searchText, slugify, stripHtml } from "./text";

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

  test("decodeEntities: tildes, ñ, símbolos y hexadecimales de las fichas (Wei, Winpy, AllTec)", () => {
    expect(
      decodeEntities(
        "Especificaci&oacute;n T&Eacute;CNICA &Ntilde; Intel&reg; Arc&trade; 90&deg; &#x2022; &amp;aacute;",
      ),
    ).toBe("Especificación TÉCNICA Ñ Intel® Arc™ 90° • &aacute;");
  });

  test("htmlLines: una línea por bloque, sin vacías", () => {
    expect(
      htmlLines(
        "<table><tr><td>MEMORIA</td><td>4 GB</td></tr><tr><td>BUS</td><td>64&nbsp;bits</td></tr></table><p></p>Fin<br>",
      ),
    ).toBe("MEMORIA 4 GB\nBUS 64 bits\nFin");
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

describe("searchText", () => {
  test("separa letras y números cuando las dos partes son sustanciales", () => {
    expect(searchText("MSI RTX 5070Ti 16G FRIEREN")).toBe("msi rtx 5070 ti 16g frieren");
    expect(searchText("MSI RTX 5070 Ti 16G")).toBe("msi rtx 5070 ti 16g");
    expect(searchText("rtx5070ti")).toBe("rtx 5070 ti");
    expect(searchText("16GB")).toBe("16 gb");
  });

  test("no rompe los tokens que distinguen productos", () => {
    expect(searchText("AMD Ryzen 7 7800X3D")).toBe("amd ryzen 7 7800x3d");
    expect(searchText("Core i5-12400F")).toBe("core i5 12400f");
    expect(searchText("Gigabyte B550M DS3H AC")).toBe("gigabyte b550m ds3h ac");
    expect(searchText("DDR5-6000")).toBe("ddr5 6000");
  });

  test("las dos formas de escribir un modelo dan lo mismo", () => {
    expect(searchText("RTX 5070Ti")).toBe(searchText("RTX 5070 Ti"));
    expect(searchText("rtx5070ti")).toBe(searchText("RTX 5070 TI"));
  });
});
