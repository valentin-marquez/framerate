import { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "bun:test";
import { countRows, deleteRow, inline, insertRow, type Query, ROWID, selectPage, updateRow } from "./sql";

let db: Database;
const all = (q: Query) => db.query(q.sql).all(...(q.params as never[]));
const run = (q: Query) => db.query(q.sql).run(...(q.params as never[]));
const page = { filters: [], sorts: [], limit: 10, offset: 0, rowid: false };

beforeEach(() => {
  db = new Database(":memory:");
  db.run(`create table "order" (id integer primary key, "my name" text, qty integer)`);
  db.run("create table loose (a text, b text)");
  db.run(`insert into "order" values (1,'uno',5),(2,'dos',null),(3,'tres',7)`);
  db.run("insert into loose values ('x','1'),('x','2')");
});

test("filtra, ordena y pagina citando nombres raros", () => {
  const q = selectPage("order", {
    ...page,
    filters: [{ column: "qty", op: ">", value: "4" }],
    sorts: [{ column: "my name", dir: "desc" }],
    limit: 1,
    offset: 1,
  });
  expect(all(q)).toEqual([{ id: 3, "my name": "tres", qty: 7 }]);
});

test("texto contra columna INTEGER usa la afinidad", () => {
  expect(all(selectPage("order", { ...page, filters: [{ column: "qty", op: "=", value: "5" }] }))).toHaveLength(1);
});

test("is null y like", () => {
  expect(all(countRows("order", [{ column: "qty", op: "is null" }]))).toEqual([{ count: 1 }]);
  expect(all(countRows("order", [{ column: "my name", op: "like", value: "%s" }]))).toEqual([{ count: 2 }]);
});

test("sin PK edita y borra por rowid sólo esa fila", () => {
  const rows = all(selectPage("loose", { ...page, rowid: true })) as Record<string, unknown>[];
  expect(rows[0]).toHaveProperty(ROWID);
  run(updateRow("loose", { rowid: rows[0]?.[ROWID] }, { b: "9" }));
  run(deleteRow("loose", { rowid: rows[1]?.[ROWID] }));
  expect(db.query("select a, b from loose").all()).toEqual([{ a: "x", b: "9" }]);
});

test("insert y update por PK", () => {
  run(insertRow("order", { id: 4, "my name": "cuatro", qty: null }));
  run(updateRow("order", { id: 4 }, { qty: "8" }));
  expect(db.query(`select qty from "order" where id = 4`).get()).toEqual({ qty: 8 });
});

test("inline arma SQL ejecutable para la consola", () => {
  const q = selectPage("order", { ...page, filters: [{ column: "my name", op: "=", value: "o'k" }], limit: 5 });
  expect(inline(q)).toBe(`select * from "order" where "my name" = 'o''k' limit 5 offset 0`);
  db.run(`insert into "order" values (9,'o''k',1)`);
  expect(all({ sql: inline(q), params: [] })).toHaveLength(1);
});
