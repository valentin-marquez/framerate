import { expect, test } from "bun:test";
import { formatted, lastDays } from "./format";

test("JSON de objeto o arreglo se muestra indentado", () => {
  expect(formatted('{"a":1,"b":[2]}')).toBe('{\n  "a": 1,\n  "b": [\n    2\n  ]\n}');
});

test("fecha ISO se muestra en hora de Chile", () => {
  expect(formatted("2026-10-05T04:27:17.248Z")).toBe("05-10-2026, 01:27:17 (Chile)");
});

test("lo demás no tiene vista formateada", () => {
  expect(formatted("hola")).toBeNull();
  expect(formatted("42")).toBeNull();
  expect(formatted(null)).toBeNull();
});

test("rellena con ceros los días sin datos", () => {
  const now = Date.parse("2026-10-11T03:00:00Z");
  expect(lastDays([{ d: "2026-10-09", n: 4 }], "n", 3, now)).toEqual([
    [Date.parse("2026-10-09T00:00:00Z"), 4],
    [Date.parse("2026-10-10T00:00:00Z"), 0],
    [Date.parse("2026-10-11T00:00:00Z"), 0],
  ]);
});
