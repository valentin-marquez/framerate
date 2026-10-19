import { describe, expect, test } from "bun:test";
import { findQuoteUrls } from "./quote-url";

describe("findQuoteUrls", () => {
  test("reconoce el public_id de una cotización sin cambiarle las mayúsculas", () => {
    const text = "test comentario https://framerate.cl/cotizacion/44CDZ8FTM2";
    expect(findQuoteUrls(text)).toEqual([
      { start: 16, end: text.length, url: "https://framerate.cl/cotizacion/44CDZ8FTM2", quoteId: "44CDZ8FTM2" },
    ]);
  });

  test("acepta el origen local y varias cotizaciones en el mismo texto", () => {
    const ids = findQuoteUrls(
      "http://localhost:5173/cotizacion/44CDZ8FTM2, luego https://framerate.cl/cotizacion/K9TQ2X7WVB.",
    ).map((hit) => hit.quoteId);
    expect(ids).toEqual(["44CDZ8FTM2", "K9TQ2X7WVB"]);
  });

  test("ignora otros hosts, otras rutas e ids que no son un public_id", () => {
    for (const text of [
      "https://otro.cl/cotizacion/44CDZ8FTM2",
      "https://framerate.cl/producto/44CDZ8FTM2",
      "https://framerate.cl/cotizacion/44cdz8ftm2",
      "https://framerate.cl/cotizacion/44CDZ8FTM",
      "https://framerate.cl/cotizacion/44CDZ8FTM2X",
      "https://framerate.cl/cotizacion/abc123",
      "https://framerate.cl/cotizacion/123e4567-e89b-12d3-a456-426614174000",
    ]) {
      expect(findQuoteUrls(text)).toEqual([]);
    }
  });
});
