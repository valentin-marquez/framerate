import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { run, runLocal, type Target } from "./targets";

const file = `${import.meta.dir}/../.test.sqlite`;
const db = new Database(file, { create: true });
db.run("create table if not exists t (a integer, b text)");
db.run("delete from t");
db.run("insert into t values (1,'x')");

test("devuelve columnas y filas en arrays", () => {
  expect(runLocal(file, "select a, b from t where a = ?", [1])).toEqual({ columns: ["a", "b"], rows: [[1, "x"]] });
});

test("una escritura devuelve filas vacías", () => {
  expect(runLocal(file, "update t set b = ? where a = 1", ["y"]).rows).toEqual([]);
});

test("SQL inválido lanza el error de SQLite", () => {
  expect(() => runLocal(file, "selec 1", [])).toThrow(/syntax error/);
});

test("un destino desconocido falla en vez de ir a producción", async () => {
  expect(run("prod" as Target, "select 1", [])).rejects.toThrow(/Destino desconocido/);
});
