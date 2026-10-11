import { Badge, Banner, Button, Input, Select, Sidebar } from "@cloudflare/kumo";
import {
  EyeIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  SunIcon,
  TableIcon,
  TerminalWindowIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { Filter } from "../sql";
import type { Target } from "../targets";
import { tables as loadTables } from "./api";
import { DataTab } from "./data-tab";
import { SqlTab } from "./sql-tab";
import { StructureTab } from "./structure-tab";
import type { View } from "./toolbar";

type Tab = { id: number; table: string; preview: boolean; view: View; filters?: Filter[] };

export function App() {
  const [target, setTarget] = useState<Target>("remote");
  const [list, setList] = useState<{ name: string; type: string }[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string>();
  // Como Supabase: cada tabla abierta es una pestaña; la de vista previa (en cursiva) se reemplaza al abrir otra.
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [active, setActive] = useState<number | "sql">();
  const [incoming, setIncoming] = useState<{ sql: string; n: number }>();
  const nextId = useRef(1);
  const dirty = useRef(new Set<number>());
  const dirtyHandlers = useRef<Record<number, (d: boolean) => void>>({});
  const [mode, setMode] = useState(document.documentElement.dataset.mode ?? "dark");
  const toggleMode = () => {
    const next = mode === "dark" ? "light" : "dark";
    document.documentElement.dataset.mode = next;
    try {
      localStorage.setItem("studio-mode", next);
    } catch {}
    setMode(next);
  };

  const pin = (id: number) =>
    setTabs((ts) =>
      ts.some((t) => t.id === id && t.preview) ? ts.map((t) => (t.id === id ? { ...t, preview: false } : t)) : ts,
    );
  // Un cambio pendiente fija la pestaña: no se puede perder por abrir otra tabla.
  // Un manejador estable por pestaña: DataTab lo usa como dependencia de un efecto.
  const onDirty = (id: number) => {
    dirtyHandlers.current[id] ??= (d: boolean) => {
      if (d) {
        dirty.current.add(id);
        pin(id);
      } else dirty.current.delete(id);
    };
    return dirtyHandlers.current[id];
  };

  const openTable = (table: string, filters?: Filter[]) => {
    const existing = tabs.find((t) => t.table === table && !t.filters);
    if (existing && !filters) return setActive(existing.id);
    const id = nextId.current++;
    setTabs((ts) => {
      const tab: Tab = { id, table, preview: true, view: "data", filters };
      const i = ts.findIndex((t) => t.preview);
      return i === -1 ? [...ts, tab] : ts.map((t, j) => (j === i ? tab : t));
    });
    setActive(id);
  };

  const closeTab = (id: number) => {
    if (dirty.current.has(id) && !window.confirm("Esta pestaña tiene cambios sin guardar. ¿Descartarlos?")) return;
    dirty.current.delete(id);
    const i = tabs.findIndex((t) => t.id === id);
    const rest = tabs.filter((t) => t.id !== id);
    setTabs(rest);
    if (active === id) setActive((rest[i] ?? rest[i - 1])?.id);
  };

  const switchTarget = (t: Target) => {
    if (dirty.current.size && !window.confirm("Hay pestañas con cambios sin guardar. ¿Descartarlos?")) return;
    dirty.current.clear();
    setTabs([]);
    setActive(undefined);
    setTarget(t);
  };

  useEffect(() => {
    setError(undefined);
    loadTables(target).then(setList, (e) => setError(e.message));
  }, [target]);

  const shown = list.filter((t) => t.name.includes(search.trim().toLowerCase()));
  const current = tabs.find((t) => t.id === active);

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
              onValueChange={(v) => v && switchTarget(v as Target)}
              items={{ remote: "Producción (D1 remota)", local: "Local (.wrangler/state)" }}
            />
            <Button
              size="sm"
              className="w-full justify-start"
              variant={active === "sql" ? "outline" : "secondary"}
              icon={<TerminalWindowIcon />}
              onClick={() => setActive("sql")}
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
                  active={current?.table === t.name}
                  onClick={() => openTable(t.name)}
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
        {tabs.length > 0 && (
          <div className="flex shrink-0 items-stretch overflow-x-auto border-b border-kumo-line bg-kumo-recessed">
            {tabs.map((t) => (
              <div
                key={t.id}
                className={`group flex items-center gap-1 border-r border-kumo-line pr-1 ${t.id === active ? "bg-kumo-base" : ""}`}
              >
                <button
                  type="button"
                  title={t.preview ? "Vista previa: doble clic para fijarla" : t.table}
                  className={`flex items-center gap-1.5 py-2 pl-3 text-sm whitespace-nowrap ${t.preview ? "italic" : ""} ${t.id === active ? "" : "text-kumo-subtle"}`}
                  onClick={() => setActive(t.id)}
                  onDoubleClick={() => pin(t.id)}
                >
                  <TableIcon />
                  {t.table}
                  {t.filters && <span className="text-xs text-kumo-subtle">(filtrada)</span>}
                </button>
                <Button
                  size="xs"
                  variant="ghost"
                  shape="square"
                  className={t.id === active ? "" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"}
                  icon={<XIcon />}
                  aria-label={`Cerrar ${t.table}`}
                  onClick={() => closeTab(t.id)}
                />
              </div>
            ))}
          </div>
        )}
        {/* Todo queda montado y sólo se oculta: cada pestaña conserva filtros, página y cambios pendientes. */}
        <div className={active === "sql" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          <SqlTab target={target} incoming={incoming} dark={mode === "dark"} />
        </div>
        {tabs.map((t) => (
          <div key={`${target}:${t.id}`} className={t.id === active ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
            <div className={t.view === "data" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
              <DataTab
                target={target}
                table={t.table}
                type={list.find((x) => x.name === t.table)?.type ?? "table"}
                initialFilters={t.filters}
                view="data"
                onView={(v) => setTabs((ts) => ts.map((x) => (x.id === t.id ? { ...x, view: v } : x)))}
                onDirty={onDirty(t.id)}
                onJump={(table, column, value) => openTable(table, [{ column, op: "=", value }])}
                onOpenSql={(sql) => {
                  setIncoming((i) => ({ sql, n: (i?.n ?? 0) + 1 }));
                  setActive("sql");
                }}
              />
            </div>
            {t.view === "structure" && (
              <StructureTab
                target={target}
                table={t.table}
                view="structure"
                onView={(v) => setTabs((ts) => ts.map((x) => (x.id === t.id ? { ...x, view: v } : x)))}
              />
            )}
          </div>
        ))}
        {active === undefined && <p className="p-6 text-kumo-subtle">Elige una tabla en la barra lateral.</p>}
      </main>
    </Sidebar.Provider>
  );
}
