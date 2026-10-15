import { expect, test } from "bun:test";
import { tablesInScope } from "./sql-editor";

test("encuentra las tablas de from, join, update e into", () => {
  expect(tablesInScope('select * from products p join "listings" l on 1 where ')).toEqual(["products", "listings"]);
  expect(tablesInScope("update stores set ")).toEqual(["stores"]);
  expect(tablesInScope("insert into quotes (")).toEqual(["quotes"]);
  expect(tablesInScope("select 1")).toEqual([]);
});
