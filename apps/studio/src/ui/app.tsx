import { Badge, Banner, Button, Input, Select, Sidebar } from "@cloudflare/kumo";
import { EyeIcon, MagnifyingGlassIcon, MoonIcon, SunIcon, TableIcon, TerminalWindowIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Filter } from "../sql";
import type { Target } from "../targets";
import { tables as loadTables } from "./api";
import { DataTab } from "./data-tab";
import { SqlTab } from "./sql-tab";
import { StructureTab } from "./structure-tab";
import type { View } from "./toolbar";

export function App() {
  const [target, setTarget] = useState<Target>("remote");
  const [list, setList] = useState<{ name: string; type: string }[]>([]);
  const [table, setTable] = useState<string>();
  const [view, setView] = useState<View | "sql">("data");
  const [search, setSearch] = useState("");
  const [sqlText, setSqlText] = useState("select name from sqlite_master where type = 'table'");
  const [error, setError] = useState<string>();
  // Un salto por clave foránea abre la tabla referenciada ya filtrada; n fuerza una grilla nueva.
  const [jump, setJump] = useState<{ n: number; filters?: Filter[] }>({ n: 0 });
  const [mode, setMode] = useState(document.documentElement.dataset.mode ?? "dark");
  const toggleMode = () => {
    const next = mode === "dark" ? "light" : "dark";
    document.documentElement.dataset.mode = next;
    try {
      localStorage.setItem("studio-mode", next);
    } catch {}
    setMode(next);
  };
  const dirty = useRef(false);
  const onDirty = useCallback((d: boolean) => {
    dirty.current = d;
  }, []);
  // Salir de la tabla desmonta la grilla y sus cambios pendientes.
  const leave = (go: () => void) => {
    if (dirty.current && !window.confirm("Hay cambios sin guardar en esta tabla. ¿Descartarlos?")) return;
    go();
  };

  useEffect(() => {
    setError(undefined);
    loadTables(target).then(setList, (e) => setError(e.message));
  }, [target]);

  const shown = list.filter((t) => t.name.includes(search.trim().toLowerCase()));
  const tableView = view === "sql" ? "data" : view;

  return (
    <Sidebar.Provider defaultOpen collapsible="none" className="h-dvh">
      <Sidebar>
        <Sidebar.Header className="h-auto! flex-col items-stretch gap-2 border-b border-kumo-line py-3">
          <div className="flex w-full items-center justify-between gap-2 px-2">
            <span className="font-semibold">D1 Studio</span>
            <div className="flex items-center gap-1">
              <Badge variant={target === "remote" ? "red" : "neutral"}>
                {target === "remote" ? "Producción" : "Local"}
              </Badge>
              <Button
                size="xs"
                variant="ghost"
                shape="square"
                icon={mode === "dark" ? <SunIcon /> : <MoonIcon />}
                aria-label={mode === "dark" ? "Modo claro" : "Modo oscuro"}
                onClick={toggleMode}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full px-2 pt-1">
            <Select
              size="sm"
              className="w-full"
              aria-label="Base"
              value={target}
              onValueChange={(v) => v && leave(() => setTarget(v as Target))}
              items={{ remote: "Producción (D1 remota)", local: "Local (.wrangler/state)" }}
            />
            <Button
              size="sm"
              className="w-full justify-start"
              variant={view === "sql" ? "outline" : "secondary"}
              icon={<TerminalWindowIcon />}
              onClick={() => leave(() => setView("sql"))}
            >
              Consola SQL
            </Button>
            <Input
              size="sm"
              aria-label="Buscar tabla"
              placeholder="Buscar tabla"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </Sidebar.Header>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>{shown.length} tablas y vistas</Sidebar.GroupLabel>
            <Sidebar.Menu>
              {shown.map((t) => (
                <Sidebar.MenuButton
                  key={t.name}
                  icon={t.type === "view" ? EyeIcon : TableIcon}
                  active={view !== "sql" && t.name === table}
                  onClick={() =>
                    leave(() => {
                      setTable(t.name);
                      setJump((j) => ({ n: j.n + 1 }));
                      if (view === "sql") setView("data");
                    })
                  }
                >
                  {t.name}
                </Sidebar.MenuButton>
              ))}
              {shown.length === 0 && list.length > 0 && (
                <p className="flex items-center gap-2 px-2 text-kumo-subtle">
                  <MagnifyingGlassIcon /> Sin resultados
                </p>
              )}
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>
      <main className="flex h-dvh min-w-0 flex-1 flex-col">
        {error && (
          <div className="border-b border-kumo-line p-3">
            <Banner variant="error" title="No se pudo leer la base" description={error} />
          </div>
        )}
        {view === "sql" ? (
          <SqlTab target={target} text={sqlText} onText={setSqlText} dark={mode === "dark"} />
        ) : !table ? (
          <p className="p-6 text-kumo-subtle">Elige una tabla en la barra lateral.</p>
        ) : tableView === "data" ? (
          <DataTab
            key={`${target}:${table}:${jump.n}`}
            target={target}
            table={table}
            initialFilters={jump.filters}
            onJump={(t, column, value) =>
              leave(() => {
                setTable(t);
                setJump((j) => ({ n: j.n + 1, filters: [{ column, op: "=", value }] }));
              })
            }
            type={list.find((t) => t.name === table)?.type ?? "table"}
            view={tableView}
            onView={(v) => leave(() => setView(v))}
            onDirty={onDirty}
            onOpenSql={(sql) =>
              leave(() => {
                setSqlText(sql);
                setView("sql");
              })
            }
          />
        ) : (
          <StructureTab key={`${target}:${table}`} target={target} table={table} view={tableView} onView={setView} />
        )}
      </main>
    </Sidebar.Provider>
  );
}
