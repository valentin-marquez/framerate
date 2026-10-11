import { Banner, Button } from "@cloudflare/kumo";
import { BookmarkSimpleIcon, PlayIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { Result, Target } from "../targets";
import { completionSchema, query } from "./api";
import { Grid } from "./grid";
import { SqlEditor } from "./sql-editor";
import { Toolbar } from "./toolbar";

type Saved = { name: string; sql: string };
const KEY = "studio-saved-queries";

// Guardadas en este navegador: son atajos personales, no datos compartidos.
const readSaved = (): Saved[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
};
const writeSaved = (list: Saved[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
};

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
  const [saved, setSaved] = useState<Saved[]>(readSaved);

  const updateSaved = (list: Saved[]) => {
    setSaved(list);
    writeSaved(list);
  };
  const save = () => {
    const name = window.prompt("Nombre de la consulta", saved.find((q) => q.sql === text)?.name ?? "")?.trim();
    if (name) updateSaved([...saved.filter((q) => q.name !== name), { name, sql: text }]);
  };

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
        <Button size="sm" icon={<BookmarkSimpleIcon />} onClick={save}>
          Guardar consulta
        </Button>
        <span className="text-xs text-kumo-subtle">
          Una sentencia a la vez. Ctrl+Espacio sugiere tablas y columnas.
        </span>
      </Toolbar>
      <div className="flex h-2/5 shrink-0 border-b border-kumo-line">
        <aside className="flex w-56 shrink-0 flex-col gap-1 overflow-auto border-r border-kumo-line p-2">
          <span className="px-1 text-xs font-medium tracking-wide text-kumo-subtle uppercase">
            Guardadas ({saved.length})
          </span>
          {saved.length === 0 && (
            <p className="px-1 text-xs text-kumo-subtle">Guarda las consultas que repites para tenerlas a un clic.</p>
          )}
          {saved.map((q) => (
            <div key={q.name} className="group flex items-center gap-1">
              <button
                type="button"
                title={q.sql}
                className={`min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-sm hover:bg-kumo-tint ${q.sql === text ? "bg-kumo-tint" : ""}`}
                onClick={() => onText(q.sql)}
              >
                {q.name}
              </button>
              <Button
                size="xs"
                variant="ghost"
                shape="square"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                icon={<XIcon />}
                aria-label={`Borrar ${q.name}`}
                onClick={() => updateSaved(saved.filter((x) => x.name !== q.name))}
              />
            </div>
          ))}
        </aside>
        <div className="min-w-0 flex-1 p-3">
          <SqlEditor value={text} onChange={onText} onRun={exec} schema={schema} dark={dark} />
        </div>
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
