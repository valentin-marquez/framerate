import { Button, Popover, Select } from "@cloudflare/kumo";
import { ArrowsDownUpIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import type { Sort } from "../sql";

// Como el "Sort" de Supabase: una lista de reglas, en orden de prioridad.
export function SortPopover({
  columns,
  sorts,
  onChange,
}: {
  columns: string[];
  sorts: Sort[];
  onChange: (sorts: Sort[]) => void;
}) {
  const free = columns.filter((c) => !sorts.some((s) => s.column === c));
  const set = (i: number, patch: Partial<Sort>) => onChange(sorts.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <Popover>
      <Popover.Trigger
        render={
          <Button size="sm" variant={sorts.length ? "outline" : "secondary"} icon={<ArrowsDownUpIcon />}>
            Orden{sorts.length > 0 && ` (${sorts.length})`}
          </Button>
        }
      />
      <Popover.Content side="bottom" align="start" className="flex w-96 flex-col gap-2 p-3">
        {sorts.length === 0 && (
          <p className="text-sm text-kumo-subtle">Sin orden: las filas salen como las guarda la base.</p>
        )}
        {sorts.map((s, i) => (
          <div key={s.column} className="flex items-center gap-2">
            <span className="w-14 text-xs text-kumo-subtle">{i === 0 ? "ordenar" : "luego"}</span>
            <Select
              size="sm"
              className="min-w-0 flex-1"
              aria-label="Columna"
              value={s.column}
              items={Object.fromEntries([s.column, ...free].map((c) => [c, c]))}
              onValueChange={(v) => v && set(i, { column: String(v) })}
            />
            <Select
              size="sm"
              aria-label="Dirección"
              value={s.dir}
              items={{ asc: "ascendente", desc: "descendente" }}
              onValueChange={(v) => v && set(i, { dir: v as Sort["dir"] })}
            />
            <Button
              size="sm"
              variant="ghost"
              shape="square"
              icon={<XIcon />}
              aria-label="Quitar orden"
              onClick={() => onChange(sorts.filter((_, j) => j !== i))}
            />
          </div>
        ))}
        <div className="flex justify-between">
          <Button
            size="sm"
            variant="ghost"
            icon={<PlusIcon />}
            disabled={free.length === 0}
            onClick={() => free[0] && onChange([...sorts, { column: free[0], dir: "asc" }])}
          >
            Agregar orden
          </Button>
          {sorts.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => onChange([])}>
              Quitar todo
            </Button>
          )}
        </div>
      </Popover.Content>
    </Popover>
  );
}
