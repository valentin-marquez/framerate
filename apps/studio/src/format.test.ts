import { expect, test } from "bun:test";
import { formatted } from "./format";

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
