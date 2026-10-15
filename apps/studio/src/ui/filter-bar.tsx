import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Filter, Op } from "../sql";

const OPS: { op: Op; label: string }[] = [
  { op: "=", label: "igual a" },
  { op: "!=", label: "distinto de" },
  { op: "contains", label: "contiene" },
  { op: ">", label: "mayor que" },
  { op: "<", label: "menor que" },
  { op: "like", label: "like (con %)" },
  { op: "is null", label: "es NULL" },
  { op: "is not null", label: "no es NULL" },
];
const opLabel = (op: Op) => (op === "contains" ? "contiene" : op);

type Stage = { kind: "column" } | { kind: "op"; column: string } | { kind: "value"; column: string; op: Op };
type Option = { key: string; label: ReactNode; pick: () => void };

const Chip = ({ children, onRemove }: { children: ReactNode; onRemove?: () => void }) => (
  <span className="flex items-center gap-1 rounded-md border border-kumo-line bg-kumo-elevated px-1.5 py-0.5 font-mono text-xs">
    {children}
    {onRemove && (
      <button
        type="button"
        aria-label="Quitar filtro"
        className="text-kumo-subtle hover:text-kumo-default"
        onClick={onRemove}
      >
        <XIcon />
      </button>
    )}
  </span>
);

// Como la Filter Bar de Supabase: un solo campo que pide columna, operador y valor, y deja cada filtro como chip.
export function FilterBar({
  columns,
  filters,
  onChange,
  loadValues,
  end,
  start,
}: {
  columns: string[];
  filters: Filter[];
  onChange: (filters: Filter[]) => void;
  loadValues: (column: string) => Promise<string[]>;
  end?: ReactNode;
  // "Filtrar por esta columna" desde la cabecera: abre la barra con la columna ya elegida.
  start?: { column: string; n: number };
}) {
  const [stage, setStage] = useState<Stage>({ kind: "column" });
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [values, setValues] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const go = (next: Stage) => {
    setStage(next);
    setText("");
    setHi(0);
    input.current?.focus();
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: sólo reacciona a un pedido nuevo
  useEffect(() => {
    if (start) go({ kind: "op", column: start.column });
  }, [start?.n]);

  const commit = (f: Filter) => {
    onChange([...filters, f]);
    go({ kind: "column" });
  };

  const q = text.trim().toLowerCase();
  const options: Option[] =
    stage.kind === "column"
      ? columns
          .filter((c) => c.toLowerCase().includes(q))
          .map((c) => ({
            key: c,
            label: <span className="font-mono">{c}</span>,
            pick: () => go({ kind: "op", column: c }),
          }))
      : stage.kind === "op"
        ? OPS.filter((o) => o.op.includes(q) || o.label.includes(q)).map((o) => ({
            key: o.op,
            label: (
              <span className="flex w-full justify-between gap-6">
                <span>{o.label}</span>
                <span className="font-mono text-kumo-subtle">{o.op}</span>
              </span>
            ),
            pick: () => {
              if (o.op.startsWith("is")) return commit({ column: stage.column, op: o.op });
              go({ kind: "value", column: stage.column, op: o.op });
              setValues([]);
              loadValues(stage.column).then(setValues, () => setValues([]));
            },
          }))
        : [
            ...(text
              ? [{ key: "\0typed", label: <span>Usar «{text}»</span>, pick: () => commit({ ...stage, value: text }) }]
              : []),
            ...values
              .filter((v) => v !== text && v.toLowerCase().includes(q))
              .map((v) => ({
                key: v,
                label: <span className="font-mono">{v}</span>,
                pick: () => commit({ ...stage, value: v }),
              })),
          ];

  const placeholder =
    stage.kind === "column"
      ? filters.length
        ? "Agregar otro filtro"
        : "Filtrar por columna"
      : stage.kind === "op"
        ? "Operador"
        : "Valor";

  return (
    <div className="flex items-center gap-2 border-b border-kumo-line px-3 py-2">
      <div className="relative min-w-0 flex-1">
        {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: el clic sólo lleva el foco al input */}
        <div
          className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-md border border-kumo-line bg-kumo-base px-2 py-1"
          onClick={() => input.current?.focus()}
        >
          <MagnifyingGlassIcon className="shrink-0 text-kumo-subtle" />
          {filters.map((f, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: el filtro no tiene otra identidad que su posición
            <Chip key={i} onRemove={() => onChange(filters.filter((_, j) => j !== i))}>
              {f.column} <span className="text-kumo-subtle">{opLabel(f.op)}</span> {f.value}
            </Chip>
          ))}
          {stage.kind !== "column" && (
            <Chip>
              {stage.column}
              {stage.kind === "value" && <span className="text-kumo-subtle"> {opLabel(stage.op)}</span>}
            </Chip>
          )}
          <input
            ref={input}
            aria-label="Filtro"
            className="min-w-32 flex-1 bg-transparent font-mono text-[13px] outline-none placeholder:font-sans placeholder:text-kumo-subtle"
            placeholder={placeholder}
            value={text}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onChange={(e) => {
              setText(e.target.value);
              setHi(0);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHi((h) => Math.min(h + 1, options.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHi((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter" || (e.key === "Tab" && options.length > 0 && open)) {
                const o = options[hi];
                if (o) {
                  e.preventDefault();
                  o.pick();
                }
              } else if (e.key === "Escape") {
                go({ kind: "column" });
                setOpen(false);
              } else if (e.key === "Backspace" && text === "") {
                if (stage.kind === "value") go({ kind: "op", column: stage.column });
                else if (stage.kind === "op") go({ kind: "column" });
                else if (filters.length) onChange(filters.slice(0, -1));
              }
            }}
          />
        </div>
        {open && options.length > 0 && (
          <ul className="absolute top-full left-0 z-30 mt-1 max-h-72 min-w-64 overflow-auto rounded-md border border-kumo-line bg-kumo-elevated p-1 shadow-lg">
            {options.map((o, i) => (
              <li key={o.key}>
                <button
                  type="button"
                  className={`flex w-full rounded px-2 py-1 text-left text-sm ${i === hi ? "bg-kumo-tint" : ""}`}
                  // mousedown para elegir antes de que el blur del input cierre la lista.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    o.pick();
                  }}
                  onMouseEnter={() => setHi(i)}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {end}
    </div>
  );
}
