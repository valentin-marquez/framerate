import { Banner, Button, InputArea } from "@cloudflare/kumo";
import { PlayIcon } from "@phosphor-icons/react";
import { useState } from "react";
import type { Result, Target } from "../targets";
import { query } from "./api";
import { Grid } from "./grid";

export function SqlTab({ target }: { target: Target }) {
  const [text, setText] = useState("select name from sqlite_master where type = 'table'");
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const exec = async () => {
    setBusy(true);
    setError(undefined);
    try {
      setResult(await query(target, text));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <InputArea
        aria-label="Consulta SQL"
        autoResize
        minRows={4}
        maxRows={20}
        className="font-mono"
        value={text}
        onValueChange={setText}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") exec();
        }}
      />
      <div className="flex items-center gap-3">
        <Button variant="primary" icon={<PlayIcon />} loading={busy} onClick={exec}>
          Ejecutar
        </Button>
        <span className="text-kumo-subtle">Ctrl+Enter. Una sentencia a la vez.</span>
        {result?.meta && (
          <span className="ml-auto text-kumo-subtle">
            {String(result.meta.rows_read ?? 0)} filas leídas, {String(result.meta.rows_written ?? 0)} escritas
          </span>
        )}
      </div>
      {error && <Banner variant="error" title="Error de la consulta" description={error} />}
      {result && <Grid columns={result.columns} rows={result.rows} />}
    </div>
  );
}
