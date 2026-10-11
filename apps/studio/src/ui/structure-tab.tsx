import { Banner } from "@cloudflare/kumo";
import { useEffect, useState } from "react";
import type { Target } from "../targets";
import { schema } from "./api";
import { Grid } from "./grid";

export function StructureTab({ target, table }: { target: Target; table: string }) {
  const [s, setS] = useState<Awaited<ReturnType<typeof schema>>>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    schema(target, table).then(setS, (e) => setError(e.message));
  }, [target, table]);

  if (error) return <Banner variant="error" title="No se pudo leer el esquema" description={error} />;
  if (!s) return null;
  const fk = s.fks[0];
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Columnas</h2>
        <Grid
          columns={["name", "type", "notnull", "dflt_value", "pk"]}
          rows={s.columns.map((c) => [c.name, c.type, c.notnull, c.dflt_value, c.pk])}
        />
      </section>
      {fk && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Claves foráneas</h2>
          <Grid columns={Object.keys(fk)} rows={s.fks.map((f) => Object.values(f))} />
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">SQL de la tabla e índices</h2>
        {s.ddl
          .filter((d) => d.sql)
          .map((d) => (
            <pre key={d.name} className="overflow-auto rounded-md bg-kumo-recessed p-3 text-xs">
              {d.sql}
            </pre>
          ))}
      </section>
    </div>
  );
}
