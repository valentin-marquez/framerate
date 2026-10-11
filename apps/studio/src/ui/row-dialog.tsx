import { Banner, Button, Checkbox, Dialog, InputArea } from "@cloudflare/kumo";
import { useState } from "react";
import { deleteRow, insertRow, type Key, type Query, updateRow } from "../sql";
import type { Target } from "../targets";
import { type Column, query } from "./api";

type Props = {
  target: Target;
  table: string;
  columns: Column[];
  open: boolean;
  // Cambia en cada apertura para reiniciar el formulario.
  formKey: number;
  // undefined: fila nueva.
  row?: Record<string, unknown>;
  keyOf: (r: Record<string, unknown>) => Key;
  onClose: (changed: boolean) => void;
};

// Siempre montado: Kumo no anima diálogos que se montan y desmontan.
export function RowDialog(props: Props) {
  return (
    <Dialog.Root open={props.open} onOpenChange={(open) => !open && props.onClose(false)}>
      <Dialog size="xl" className="flex max-h-[85dvh] flex-col gap-4 overflow-auto p-6">
        <RowForm key={props.formKey} {...props} />
      </Dialog>
    </Dialog.Root>
  );
}

function RowForm({ target, table, columns, row, keyOf, onClose }: Props) {
  const init = Object.fromEntries(columns.map((c) => [c.name, row ? row[c.name] : null]));
  const [values, setValues] = useState<Record<string, unknown>>(init);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const changed = Object.fromEntries(Object.entries(values).filter(([k, v]) => v !== init[k]));
  // En una fila nueva sólo van las columnas tocadas: las demás toman su DEFAULT.
  const save = row ? updateRow(table, keyOf(row), changed) : insertRow(table, changed);

  const exec = async (q: Query) => {
    try {
      await query(target, q.sql, q.params);
      onClose(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <Dialog.Title className="text-base font-semibold">
        {row ? `Editar fila de ${table}` : `Nueva fila en ${table}`}
      </Dialog.Title>
      {columns.map((c) => (
        <div key={c.name} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[0.9em]">
              {c.name} <span className="text-kumo-subtle">{c.pk ? `${c.type} PK` : c.type}</span>
            </span>
            <Checkbox
              label="NULL"
              checked={values[c.name] === null}
              onCheckedChange={(on) => setValues((v) => ({ ...v, [c.name]: on ? null : "" }))}
            />
          </div>
          <InputArea
            aria-label={c.name}
            autoResize
            maxRows={12}
            className="font-mono"
            disabled={values[c.name] === null}
            value={values[c.name] === null ? "" : String(values[c.name])}
            onValueChange={(text) => setValues((v) => ({ ...v, [c.name]: text }))}
          />
        </div>
      ))}
      <pre className="overflow-auto rounded-md bg-kumo-recessed p-3 text-xs">
        {save.sql}
        {"\n"}
        {JSON.stringify(save.params)}
      </pre>
      {error && <Banner variant="error" title="D1 rechazó el cambio" description={error} />}
      <div className="flex justify-between gap-2">
        {row ? (
          <Button
            variant={confirmDelete ? "destructive" : "secondary-destructive"}
            onClick={() => (confirmDelete ? exec(deleteRow(table, keyOf(row))) : setConfirmDelete(true))}
          >
            {confirmDelete ? "Sí, borrar la fila" : "Borrar"}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button onClick={() => onClose(false)}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={row !== undefined && Object.keys(changed).length === 0}
            onClick={() => exec(save)}
          >
            {row ? "Guardar" : "Insertar"}
          </Button>
        </div>
      </div>
    </>
  );
}
