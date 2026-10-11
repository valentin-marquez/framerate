import { Banner, Button, Checkbox, DropdownMenu, Input, Pagination, Select } from "@cloudflare/kumo";
import {
  ArrowClockwiseIcon,
  ArrowDownIcon,
  ArrowsOutSimpleIcon,
  ArrowUpIcon,
  CodeIcon,
  DotsThreeIcon,
  FunnelSimpleIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { toCsv } from "../csv";
import {
  countRows,
  deleteRow,
  type Filter,
  inline,
  type Key,
  type Op,
  ROWID,
  type Sort,
  selectPage,
  updateRow,
} from "../sql";
import type { Result, Target } from "../targets";
import { type Column, objects, query, schema } from "./api";
import { ColumnLabel, Grid, showValue } from "./grid";
import { RowDialog } from "./row-dialog";
import { Toolbar, type View } from "./toolbar";

const OPS: Op[] = ["=", "!=", ">", "<", "like", "is null", "is not null"];
const PER_PAGE = 50;

type Row = Record<string, unknown>;
type Pending = Record<string, { key: Key; values: Row }>;

function download(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function DataTab({
  target,
  table,
  view,
  onView,
  onOpenSql,
}: {
  target: Target;
  table: string;
  view: View;
  onView: (v: View) => void;
  onOpenSql: (sql: string) => void;
}) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sorts, setSorts] = useState<Sort[]>([]);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result>();
  const [total, setTotal] = useState<number>();
  const [ms, setMs] = useState<number>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<Pending>({});
  const [editingCell, setEditingCell] = useState<{ row: number; column: string }>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; row?: Row; formKey: number }>({ open: false, formKey: 0 });

  const pk = columns.filter((c) => c.pk > 0).map((c) => c.name);
  const rowid = columns.length > 0 && pk.length === 0;
  const keyOf = (r: Row): Key => (rowid ? { rowid: r[ROWID] } : Object.fromEntries(pk.map((k) => [k, r[k]])));
  const rk = (r: Row) => JSON.stringify(keyOf(r));
  // Como en Drizzle, un filtro a medio escribir no filtra.
  const active = filters.filter((f) => f.op.startsWith("is") || f.value);
  const pageQuery = () =>
    selectPage(table, { filters: active, sorts, limit: PER_PAGE, offset: (page - 1) * PER_PAGE, rowid });

  useEffect(() => {
    schema(target, table).then(
      (s) => setColumns(s.columns),
      (e) => setError(e.message),
    );
  }, [target, table]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pageQuery depende de lo listado
  const load = useCallback(async () => {
    if (columns.length === 0) return;
    setError(undefined);
    const t0 = performance.now();
    try {
      const q = pageQuery();
      const c = countRows(table, active);
      const [r, n] = await Promise.all([query(target, q.sql, q.params), query(target, c.sql, c.params)]);
      setResult(r);
      setTotal(Number(n.rows[0]?.[0] ?? 0));
      setMs(Math.round(performance.now() - t0));
      setSelected(new Set());
      setConfirmDelete(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [target, table, columns, JSON.stringify(active), sorts, page, rowid]);

  useEffect(() => {
    load();
  }, [load]);

  const editFilters = (fn: (fs: Filter[]) => Filter[]) => {
    setFilters(fn);
    setPage(1);
  };
  const setFilter = (i: number, patch: Partial<Filter>) =>
    editFilters((fs) => fs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addFilter = () => {
    const first = columns[0];
    if (first) editFilters((fs) => [...fs, { column: first.name, op: "=", value: "" }]);
  };

  const toggleSort = (column: string) => {
    setSorts((s) => {
      const cur = s.find((x) => x.column === column);
      if (!cur) return [...s, { column, dir: "asc" }];
      if (cur.dir === "asc") return s.map((x) => (x.column === column ? { column, dir: "desc" } : x));
      return s.filter((x) => x.column !== column);
    });
    setPage(1);
  };

  const rows = result ? objects(result) : [];
  const visible = result ? result.columns.filter((c) => c !== ROWID) : [];
  const types = Object.fromEntries(columns.map((c) => [c.name, c.type]));
  const valueAt = (r: Row, c: string) => {
    const p = pending[rk(r)]?.values;
    return p && c in p ? p[c] : r[c];
  };

  const commitCell = (r: Row, column: string, text: string) => {
    setEditingCell(undefined);
    if (text === String(valueAt(r, column) ?? "")) return;
    const k = rk(r);
    setPending((p) => {
      const values = { ...p[k]?.values, [column]: text };
      // Volver al valor original deshace el cambio.
      if (String(r[column] ?? "") === text) delete values[column];
      const next = { ...p };
      if (Object.keys(values).length) next[k] = { key: keyOf(r), values };
      else delete next[k];
      return next;
    });
  };

  const changes = Object.values(pending).map((p) => updateRow(table, p.key, p.values));

  const saveChanges = async () => {
    setBusy(true);
    try {
      for (const [k, p] of Object.entries(pending)) {
        const q = updateRow(table, p.key, p.values);
        await query(target, q.sql, q.params);
        setPending(({ [k]: _, ...rest }) => rest);
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const deleteSelected = async () => {
    setBusy(true);
    try {
      for (const k of selected) {
        const q = deleteRow(table, JSON.parse(k));
        await query(target, q.sql, q.params);
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const allKeys = rows.map(rk);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));
  const toggle = (k: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (!n.delete(k)) n.add(k);
      return n;
    });

  const exportRows = () => rows.map((r) => Object.fromEntries(visible.map((c) => [c, r[c]])));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar
        view={view}
        onView={onView}
        end={
          <>
            {ms !== undefined && (
              <span className="text-xs whitespace-nowrap text-kumo-subtle tabular-nums">{ms} ms</span>
            )}
            <Pagination page={page} perPage={PER_PAGE} totalCount={total} setPage={setPage}>
              <Pagination.Info>
                {({ pageShowingRange }) => (
                  <span className="tabular-nums">
                    {total ? `${pageShowingRange} de ${total.toLocaleString("es-CL")}` : "0 filas"}
                  </span>
                )}
              </Pagination.Info>
              <Pagination.Controls controls="simple" />
            </Pagination>
            <Button size="sm" shape="square" icon={<ArrowClockwiseIcon />} aria-label="Refrescar" onClick={load} />
            <DropdownMenu>
              <DropdownMenu.Trigger
                render={<Button size="sm" shape="square" icon={<DotsThreeIcon />} aria-label="Más acciones" />}
              />
              <DropdownMenu.Content>
                <DropdownMenu.Item
                  onClick={() => download(`${table}.csv`, toCsv(visible, exportRows().map(Object.values)), "text/csv")}
                >
                  Exportar página a CSV
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onClick={() => download(`${table}.json`, JSON.stringify(exportRows(), null, 2), "application/json")}
                >
                  Exportar página a JSON
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </>
        }
      >
        <Button
          size="sm"
          variant={showFilters ? "outline" : "secondary"}
          icon={<FunnelSimpleIcon />}
          onClick={() => {
            if (!showFilters && filters.length === 0) addFilter();
            setShowFilters(!showFilters);
          }}
        >
          Filtros{active.length > 0 && ` (${active.length})`}
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon={<PlusIcon />}
          onClick={() => setDialog((d) => ({ open: true, row: undefined, formKey: d.formKey + 1 }))}
        >
          Agregar fila
        </Button>
        {selected.size > 0 && (
          <Button
            size="sm"
            variant={confirmDelete ? "destructive" : "secondary-destructive"}
            icon={<TrashIcon />}
            loading={busy}
            onClick={() => (confirmDelete ? deleteSelected() : setConfirmDelete(true))}
          >
            {confirmDelete ? `Sí, borrar ${selected.size}` : `Borrar ${selected.size}`}
          </Button>
        )}
      </Toolbar>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 border-b border-kumo-line bg-kumo-recessed px-3 py-2">
          {filters.map((f, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: el filtro no tiene otra identidad que su posición
            <div key={i} className="flex items-center gap-1">
              <span className="w-12 text-xs text-kumo-subtle">{i === 0 ? "where" : "and"}</span>
              <Select
                size="sm"
                value={f.column}
                items={Object.fromEntries(columns.map((c) => [c.name, c.name]))}
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
                  className="font-mono"
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
          <Button size="sm" variant="ghost" icon={<PlusIcon />} onClick={addFilter}>
            Filtro
          </Button>
          <Button size="sm" variant="ghost" icon={<CodeIcon />} onClick={() => onOpenSql(inline(pageQuery()))}>
            Abrir en SQL
          </Button>
          {filters.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => editFilters(() => [])}>
              Limpiar
            </Button>
          )}
        </div>
      )}

      {error && (
        <div className="border-b border-kumo-line p-3">
          <Banner variant="error" title="Error de la consulta" description={error} />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {result && (
          <Grid
            columns={visible.map((name) => ({ name, type: types[name] }))}
            rows={rows.map((r) => visible.map((c) => valueAt(r, c)))}
            leading={{
              header: (
                <Checkbox
                  aria-label="Seleccionar todas"
                  checked={allSelected}
                  indeterminate={selected.size > 0 && !allSelected}
                  onCheckedChange={() => setSelected(allSelected ? new Set() : new Set(allKeys))}
                />
              ),
              cell: (i) => {
                const r = rows[i] as Row;
                return (
                  <div className="flex items-center gap-1">
                    <Checkbox
                      aria-label="Seleccionar fila"
                      checked={selected.has(rk(r))}
                      onCheckedChange={() => toggle(rk(r))}
                    />
                    <Button
                      size="xs"
                      variant="ghost"
                      shape="square"
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      icon={<ArrowsOutSimpleIcon />}
                      aria-label="Abrir fila"
                      onClick={() => setDialog((d) => ({ open: true, row: r, formKey: d.formKey + 1 }))}
                    />
                  </div>
                );
              },
            }}
            head={(c) => {
              const s = sorts.find((x) => x.column === c.name);
              return (
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2"
                  onClick={() => toggleSort(c.name)}
                >
                  <ColumnLabel column={c} />
                  {s?.dir === "asc" && <ArrowUpIcon />}
                  {s?.dir === "desc" && <ArrowDownIcon />}
                </button>
              );
            }}
            cell={(i, j, v) => {
              const r = rows[i] as Row;
              const column = visible[j] as string;
              const dirty = pending[rk(r)]?.values && column in (pending[rk(r)]?.values ?? {});
              if (editingCell?.row === i && editingCell.column === column) {
                return (
                  <input
                    // biome-ignore lint/a11y/noAutofocus: la celda entra en edición por doble clic
                    autoFocus
                    aria-label={column}
                    className="w-full bg-transparent font-mono outline-none"
                    defaultValue={v === null ? "" : String(v)}
                    onBlur={(e) => commitCell(r, column, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitCell(r, column, e.currentTarget.value);
                      if (e.key === "Escape") setEditingCell(undefined);
                    }}
                  />
                );
              }
              return (
                <button
                  type="button"
                  title={v === null ? "NULL" : String(v)}
                  className={`block w-full truncate text-left ${dirty ? "text-kumo-warning" : ""}`}
                  onDoubleClick={() => setEditingCell({ row: i, column })}
                >
                  {showValue(v)}
                </button>
              );
            }}
          />
        )}
      </div>

      {changes.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-kumo-line bg-kumo-elevated px-3 py-2 text-sm">
          <span>
            {changes.length === 1
              ? "1 fila con cambios sin guardar"
              : `${changes.length} filas con cambios sin guardar`}
          </span>
          <details className="min-w-0 flex-1">
            <summary className="cursor-pointer text-kumo-subtle">Ver SQL</summary>
            <pre className="mt-2 max-h-40 overflow-auto font-mono text-xs">{changes.map(inline).join(";\n")}</pre>
          </details>
          <Button size="sm" onClick={() => setPending({})}>
            Descartar
          </Button>
          <Button size="sm" variant="primary" loading={busy} onClick={saveChanges}>
            Guardar cambios
          </Button>
        </div>
      )}

      <RowDialog
        target={target}
        table={table}
        columns={columns}
        open={dialog.open}
        formKey={dialog.formKey}
        row={dialog.row}
        keyOf={keyOf}
        onClose={(changed) => {
          setDialog((d) => ({ ...d, open: false }));
          if (changed) load();
        }}
      />
    </div>
  );
}
