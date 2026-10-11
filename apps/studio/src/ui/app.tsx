import { Badge, Banner, Select, Sidebar, Tabs } from "@cloudflare/kumo";
import { EyeIcon, TableIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { Target } from "../targets";
import { tables as loadTables } from "./api";
import { DataTab } from "./data-tab";
import { SqlTab } from "./sql-tab";
import { StructureTab } from "./structure-tab";

export function App() {
  const [target, setTarget] = useState<Target>("remote");
  const [list, setList] = useState<{ name: string; type: string }[]>([]);
  const [table, setTable] = useState<string>();
  const [tab, setTab] = useState("data");
  const [error, setError] = useState<string>();

  useEffect(() => {
    setError(undefined);
    loadTables(target).then(setList, (e) => setError(e.message));
  }, [target]);

  return (
    <Sidebar.Provider defaultOpen collapsible="none" className="h-dvh">
      <Sidebar>
        <Sidebar.Header>
          <div className="flex flex-col gap-2 px-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">D1 Studio</span>
              <Badge variant={target === "remote" ? "red" : "neutral"}>
                {target === "remote" ? "Producción" : "Local"}
              </Badge>
            </div>
            <Select
              className="w-full"
              value={target}
              onValueChange={(v) => v && setTarget(v as Target)}
              items={{ remote: "Producción (D1 remota)", local: "Local (.wrangler/state)" }}
            />
          </div>
        </Sidebar.Header>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Tablas</Sidebar.GroupLabel>
            <Sidebar.Menu>
              {list.map((t) => (
                <Sidebar.MenuButton
                  key={t.name}
                  icon={t.type === "view" ? EyeIcon : TableIcon}
                  active={t.name === table}
                  onClick={() => setTable(t.name)}
                >
                  {t.name}
                </Sidebar.MenuButton>
              ))}
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>
      <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-6">
        {error && <Banner variant="error" title="No se pudo leer la base" description={error} />}
        <div className="flex items-center gap-4">
          <h1 className="font-mono text-base font-semibold">{tab === "sql" ? "Consola SQL" : (table ?? "")}</h1>
          <Tabs
            value={tab}
            onValueChange={setTab}
            tabs={[
              { value: "data", label: "Datos" },
              { value: "structure", label: "Estructura" },
              { value: "sql", label: "SQL" },
            ]}
          />
        </div>
        {tab === "sql" ? (
          <SqlTab target={target} />
        ) : !table ? (
          <p className="text-kumo-subtle">Elige una tabla.</p>
        ) : tab === "data" ? (
          <DataTab key={`${target}:${table}`} target={target} table={table} />
        ) : (
          <StructureTab key={`${target}:${table}`} target={target} table={table} />
        )}
      </main>
    </Sidebar.Provider>
  );
}
