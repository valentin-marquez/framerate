import { Banner, Button, Input, Pagination, Select } from "@cloudflare/kumo";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { countRows, type Filter, type Op, ROWID, type Sort, selectPage } from "../sql";
import type { Result, Target } from "../targets";
import { type Column, objects, query, schema } from "./api";
import { Grid } from "./grid";
import { RowDialog } from "./row-dialog";

const OPS: Op[] = ["=", "!=", ">", "<", "like", "is null", "is not null"];
const PER_PAGE = 50;

function download(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const csv = (columns: string[], rows: unknown[][]) =>
  [columns, ...rows]
    .map((row) => row.map((v) => (v === null ? "" : `"${String(v).replaceAll('"', '""')}"`)).join(","))
    .join("\n");

export function DataTab({ target, table }: { target: Target; table: string }) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sorts, setSorts] = useState<Sort[]>([]);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result>();
  const [total, setTotal] = useState<number>();
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<Record<string, unknown>>();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const pk = columns.filter((c) => c.pk > 0).map((c) => c.name);
  const rowid = columns.length > 0 && pk.length === 0;

  useEffect(() => {
    schema(target, table).then(
      (s) => setColumns(s.columns),
      (e) => setError(e.message),
    );
  }, [target, table]);

  const load = useCallback(async () => {
    if (columns.length === 0) return;
    setError(undefined);
    try {
      const q = selectPage(table, { filters, sorts, limit: PER_PAGE, offset: (page - 1) * PER_PAGE, rowid });
      const c = countRows(table, filters);
      const [r, n] = await Promise.all([query(target, q.sql, q.params), query(target, c.sql, c.params)]);
      setResult(r);
      setTotal(Number(n.rows[0]?.[0] ?? 0));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [target, table, columns, filters, sorts, page, rowid]);

  useEffect(() => {
    load();
  }, [load]);

  const editFilters = (fn: (fs: Filter[]) => Filter[]) => {
    setFilters(fn);
    setPage(1);
  };
  const setFilter = (i: number, patch: Partial<Filter>) =>
    editFilters((fs) => fs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const toggleSort = (column: string) => {
    setSorts((s) => {
      const cur = s.find((x) => x.column === column);
      if (!cur) return [...s, { column, dir: "asc" }];
      if (cur.dir === "asc") return s.map((x) => (x.column === column ? { column, dir: "desc" } : x));
      return s.filter((x) => x.column !== column);
    });
    setPage(1);
  };

  const visible = result ? result.columns.filter((c) => c !== ROWID) : [];
  const rows = result ? objects(result) : [];
  const cells = rows.map((r) => visible.map((c) => r[c]));
  const columnItems = Object.fromEntries(columns.map((c) => [c.name, c.name]));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: el filtro no tiene otra identidad que su posición
          <div key={i} className="flex items-center gap-1">
            <Select
              size="sm"
              value={f.column}
              items={columnItems}
              onValueChange={(v) => setFilter(i, { column: String(v) })}
            />
            <Select
              size="sm"
              value={f.op}
              items={Object.fromEntries(OPS.map((o) => [o, o]))}
              onValueChange={(v) => setFilter(i, { op: v as Op })}
            />
            {!f.op.startsWith("is") && (
              <Input
                size="sm"
                value={f.value ?? ""}
                placeholder="valor"
                aria-label="Valor del filtro"
                onChange={(e) => setFilter(i, { value: e.target.value })}
              />
            )}
            <Button
              size="sm"
              variant="ghost"
              shape="square"
              icon={<XIcon />}
              aria-label="Quitar filtro"
              onClick={() => editFilters((fs) => fs.filter((_, j) => j !== i))}
            />
          </div>
        ))}
        <Button
          size="sm"
          icon={<PlusIcon />}
          onClick={() => {
            const first = columns[0];
            if (first) editFilters((fs) => [...fs, { column: first.name, op: "=", value: "" }]);
          }}
        >
          Filtro
        </Button>
        <div className="ml-auto flex gap-2">
          <Button size="sm" onClick={() => download(`${table}.csv`, csv(visible, cells), "text/csv")}>
            CSV
          </Button>
          <Button
            size="sm"
            onClick={() =>
              download(
                `${table}.json`,
                JSON.stringify(
                  rows.map((r) => Object.fromEntries(visible.map((c) => [c, r[c]]))),
                  null,
                  2,
                ),
                "application/json",
              )
            }
          >
            JSON
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<PlusIcon />}
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
              setFormKey((k) => k + 1);
            }}
          >
            Fila
          </Button>
        </div>
      </div>
      {error && <Banner variant="error" title="Error de la consulta" description={error} />}
      {result && (
        <Grid
          columns={visible}
          rows={cells}
          onRowClick={(i) => {
            setEditing(rows[i]);
            setOpen(true);
            setFormKey((k) => k + 1);
          }}
          head={(c) => {
            const s = sorts.find((x) => x.column === c);
            return (
              <button type="button" className="flex items-center gap-1" onClick={() => toggleSort(c)}>
                {c}
                {s?.dir === "asc" && <ArrowUpIcon />}
                {s?.dir === "desc" && <ArrowDownIcon />}
              </button>
            );
          }}
        />
      )}
      <Pagination page={page} perPage={PER_PAGE} totalCount={total} setPage={setPage} />
      <RowDialog
        target={target}
        table={table}
        columns={columns}
        open={open}
        formKey={formKey}
        row={editing}
        keyOf={(r) => (rowid ? { rowid: r[ROWID] } : Object.fromEntries(pk.map((k) => [k, r[k]])))}
        onClose={(changed) => {
          setOpen(false);
          if (changed) load();
        }}
      />
    </div>
  );
}
