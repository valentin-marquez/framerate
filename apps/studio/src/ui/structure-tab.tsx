import { Banner, Button, LayerCard } from "@cloudflare/kumo";
import { CopyIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useState } from "react";
import type { Target } from "../targets";
import { schema } from "./api";
import { Toolbar, type View } from "./toolbar";

const Kw = ({ children }: { children: ReactNode }) => <span className="text-kumo-danger">{children}</span>;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-medium tracking-wide text-kumo-subtle uppercase">{title}</h2>
      <div className="divide-y divide-kumo-line overflow-hidden rounded-md border border-kumo-line font-mono text-[13px]">
        {children}
      </div>
    </section>
  );
}

const Line = ({ children }: { children: ReactNode }) => <div className="bg-kumo-recessed px-3 py-2">{children}</div>;

export function StructureTab({
  target,
  table,
  view,
  onView,
}: {
  target: Target;
  table: string;
  view: View;
  onView: (v: View) => void;
}) {
  const [s, setS] = useState<Awaited<ReturnType<typeof schema>>>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    schema(target, table).then(setS, (e) => setError(e.message));
  }, [target, table]);

  const ddl = s?.ddl.filter((d) => d.sql) ?? [];
  const indexes = ddl.filter((d) => d.type === "index");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar view={view} onView={onView}>
        <Button
          size="sm"
          icon={<CopyIcon />}
          onClick={async () => {
            await navigator.clipboard.writeText(ddl.map((d) => `${d.sql};`).join("\n\n"));
            setCopied(true);
          }}
        >
          {copied ? "Copiado" : "Copiar CREATE"}
        </Button>
      </Toolbar>
      <div className="min-h-0 flex-1 overflow-auto bg-kumo-recessed p-6">
        {error && <Banner variant="error" title="No se pudo leer el esquema" description={error} />}
        {s && (
          <LayerCard className="flex max-w-3xl flex-col gap-6 p-6">
            <Section title="Columnas">
              {s.columns.map((c) => (
                <Line key={c.name}>
                  {c.name} <Kw>{c.type || "ANY"}</Kw>
                  {c.pk > 0 && <Kw> PRIMARY KEY</Kw>}
                  {c.notnull > 0 && <Kw> NOT NULL</Kw>}
                  {c.dflt_value !== null && (
                    <>
                      <Kw> DEFAULT</Kw> {String(c.dflt_value)}
                    </>
                  )}
                </Line>
              ))}
            </Section>
            {s.fks.length > 0 && (
              <Section title="Claves foráneas">
                {s.fks.map((f) => (
                  <Line key={`${f.id}-${f.seq}`}>
                    <Kw>FOREIGN KEY</Kw> ({String(f.from)}) <Kw>REFERENCES</Kw> {String(f.table)}({String(f.to)})
                    {f.on_delete !== "NO ACTION" && (
                      <>
                        <Kw> ON DELETE</Kw> {String(f.on_delete)}
                      </>
                    )}
                  </Line>
                ))}
              </Section>
            )}
            {indexes.length > 0 && (
              <Section title="Índices">
                {indexes.map((d) => (
                  <Line key={d.name}>{d.sql}</Line>
                ))}
              </Section>
            )}
          </LayerCard>
        )}
      </div>
    </div>
  );
}
