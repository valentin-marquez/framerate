import { Banner, Button } from "@cloudflare/kumo";
import { PlayIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { Result, Target } from "../targets";
import { completionSchema, query } from "./api";
import { Grid } from "./grid";
import { SqlEditor } from "./sql-editor";
import { Toolbar } from "./toolbar";

export function SqlTab({
  target,
  text,
  onText,
  dark,
}: {
  target: Target;
  text: string;
  onText: (t: string) => void;
  dark: boolean;
}) {
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [schema, setSchema] = useState<Record<string, string[]>>({});

  useEffect(() => {
    completionSchema(target).then(setSchema, () => setSchema({}));
  }, [target]);

  const exec = async () => {
    setBusy(true);
    setError(undefined);
    try {
      setResult(await query(target, text));
    } catch (e) {
      setError((e as Error).message);
      setResult(undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar
        end={
          result?.meta && (
            <span className="text-xs text-kumo-subtle tabular-nums">
              {String(result.meta.rows_read ?? 0)} filas leídas, {String(result.meta.rows_written ?? 0)} escritas,{" "}
              {Math.round(Number(result.meta.duration ?? 0))} ms
            </span>
          )
        }
      >
        <Button size="sm" variant="primary" icon={<PlayIcon />} loading={busy} onClick={exec}>
          Ejecutar <kbd className="ml-1 rounded bg-white/20 px-1 text-xs">Ctrl+Enter</kbd>
        </Button>
        <span className="text-xs text-kumo-subtle">
          Una sentencia a la vez. Ctrl+Espacio sugiere tablas y columnas.
        </span>
      </Toolbar>
      <div className="h-2/5 shrink-0 border-b border-kumo-line p-3">
        <SqlEditor value={text} onChange={onText} onRun={exec} schema={schema} dark={dark} />
      </div>
      {error && (
        <div className="p-3">
          <Banner variant="error" title="Error de la consulta" description={error} />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {result &&
          (result.columns.length > 0 ? (
            <Grid columns={result.columns.map((name) => ({ name }))} rows={result.rows} />
          ) : (
            <p className="p-3 text-kumo-subtle">Sentencia ejecutada sin filas de resultado.</p>
          ))}
      </div>
    </div>
  );
}
