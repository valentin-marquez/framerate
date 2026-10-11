import { expect, test } from "bun:test";
import { toCsv } from "./csv";

test("cita, escapa comillas y deja NULL vacío", () => {
  expect(toCsv(["a", "b"], [['x"y', null]])).toBe('"a","b"\n"x""y",');
});

test("neutraliza fórmulas de planilla", () => {
  expect(toCsv(["a"], [["=HYPERLINK(1)"], ["+1"], ["-2"], ["@x"], [-3]])).toBe(
    `"a"\n"'=HYPERLINK(1)"\n"'+1"\n"'-2"\n"'@x"\n"-3"`,
  );
});
