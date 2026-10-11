import { LayerCard, Table } from "@cloudflare/kumo";
import type { ReactNode } from "react";

const show = (v: unknown) => (v === null ? <span className="text-kumo-subtle italic">NULL</span> : String(v));

export function Grid({
  columns,
  rows,
  onRowClick,
  head,
}: {
  columns: string[];
  rows: unknown[][];
  onRowClick?: (i: number) => void;
  head?: (column: string) => ReactNode;
}) {
  return (
    <LayerCard className="overflow-auto p-0">
      <Table>
        <Table.Header>
          <Table.Row>
            {columns.map((c) => (
              <Table.Head key={c} className="whitespace-nowrap">
                {head ? head(c) : c}
              </Table.Head>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((row, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: filas sin clave estable (consultas arbitrarias)
            <Table.Row key={i} onClick={() => onRowClick?.(i)} className={onRowClick ? "cursor-pointer" : ""}>
              {row.map((v, j) => (
                <Table.Cell key={columns[j]} className="max-w-80 truncate font-mono text-[0.9em]">
                  {show(v)}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </LayerCard>
  );
}
