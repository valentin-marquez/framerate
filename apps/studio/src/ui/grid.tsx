import { Table } from "@cloudflare/kumo";
import { KeyIcon, LinkSimpleIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

// fk: tabla referenciada, para el ícono de vínculo.
export type GridColumn = { name: string; type?: string; pk?: boolean; fk?: string };

export const showValue = (v: unknown) =>
  v === null ? <span className="text-kumo-subtle italic">NULL</span> : String(v);

// Grilla densa al estilo Drizzle: celdas con borde, cabecera fija con nombre y tipo.
export function Grid({
  columns,
  rows,
  head,
  cell,
  leading,
}: {
  columns: GridColumn[];
  rows: unknown[][];
  head?: (column: GridColumn) => ReactNode;
  cell?: (row: number, column: number, value: unknown) => ReactNode;
  leading?: { header: ReactNode; cell: (row: number) => ReactNode };
}) {
  const th = "sticky top-0 z-10 border-r border-b border-kumo-line bg-kumo-elevated px-2! py-1.5! whitespace-nowrap";
  return (
    <Table className="w-max min-w-full">
      <Table.Header variant="compact">
        <Table.Row>
          {leading && <Table.Head className={`${th} w-14`}>{leading.header}</Table.Head>}
          {columns.map((c) => (
            <Table.Head key={c.name} className={th}>
              {head ? head(c) : <ColumnLabel column={c} />}
            </Table.Head>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((row, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: filas sin clave estable (consultas arbitrarias)
          <Table.Row key={i} className="group">
            {leading && (
              <Table.Cell className="border-r border-b border-kumo-line px-2! py-0!">{leading.cell(i)}</Table.Cell>
            )}
            {row.map((v, j) => (
              <Table.Cell
                key={columns[j]?.name ?? j}
                className="max-w-72 truncate border-r border-b border-kumo-line px-2! py-1! font-mono text-[13px]"
              >
                {cell ? cell(i, j, v) : showValue(v)}
              </Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

export function ColumnLabel({ column }: { column: GridColumn }) {
  return (
    <span className="flex items-center gap-1.5">
      {column.pk && <KeyIcon className="shrink-0 text-kumo-warning" aria-label="Clave primaria" />}
      {column.fk && <LinkSimpleIcon className="shrink-0 text-kumo-brand" aria-label={`Referencia a ${column.fk}`} />}
      <span className="font-medium">{column.name}</span>
      {column.type && <span className="text-xs font-normal text-kumo-subtle lowercase">{column.type}</span>}
    </span>
  );
}
