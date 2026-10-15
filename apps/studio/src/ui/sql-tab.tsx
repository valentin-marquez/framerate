import { Banner, Button, Input } from "@cloudflare/kumo";
import { BookmarkSimpleIcon, PlayIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { Result, Target } from "../targets";
import { completionSchema, query } from "./api";
import { Grid } from "./grid";
import { SqlEditor } from "./sql-editor";
import { Toolbar } from "./toolbar";

type Saved = { name: string; sql: string };
type QueryTab = { id: number; name: string; text: string; result?: Result; error?: string };
const KEY = "studio-saved-queries";

// Las de la skill /prod-health: lo que se mira primero cuando algo anda raro.
const TEMPLATES: Saved[] = [
  {
    name: "Resumen del catálogo",
    sql: `select (select count(*) from products) productos,
       (select count(*) from listings where is_active = 1) ofertas,
       (select count(*) from listings where is_active = 1 and in_stock = 1) con_stock,
       (select count(*) from match_reviews where status = 'pending') revisiones,
       (select count(*) from crawl_runs where status = 'failed') fallidas,
       (select max(started_at) from crawl_runs) ultima`,
  },
  {
    name: "Cuarentena por tienda y motivo",
    sql: `select s.slug, q.reason, count(*) n
from quarantine q join stores s on s.id = q.store_id
group by 1, 2 order by n desc limit 15`,
  },
  {
    name: "Última corrida por tienda y categoría",
    sql: `select s.slug, r.category, r.status, r.started_at, r.stats
from crawl_runs r join stores s on s.id = r.store_id
where r.started_at = (select max(started_at) from crawl_runs r2 where r2.store_id = r.store_id and r2.category = r.category)
order by s.slug, r.category`,
  },
  {
    name: "Estado de normalización",
    sql: "select norm_status, count(*) n, min(updated_at) desde from listings where is_active = 1 group by 1",
  },
  {
    name: "Gasto de IA, últimos 7 días",
    sql: `select substr(at, 1, 10) dia, purpose, status, count(*) llamadas, round(sum(usd), 4) usd
from ai_usage where at >= datetime('now', '-7 days')
group by 1, 2, 3 order by 1 desc, 2`,
  },
  {
    name: "Revisiones de matching pendientes",
    sql: "select * from match_reviews where status = 'pending' order by id desc limit 50",
  },
];

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

function QueryList({
  title,
  items,
  current,
  onPick,
  onRemove,
}: {
  title: string;
  items: Saved[];
  current: string;
  onPick: (q: Saved) => void;
  onRemove?: (q: Saved) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="px-1 pt-2 text-xs font-medium tracking-wide text-kumo-subtle uppercase">
        {title} ({items.length})
      </span>
      {items.map((q) => (
        <div key={q.name} className="group flex items-center gap-1">
          <button
            type="button"
            title={q.sql}
            className={`min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-sm hover:bg-kumo-tint ${q.sql === current ? "bg-kumo-tint" : ""}`}
            onClick={() => onPick(q)}
          >
            {q.name}
          </button>
          {onRemove && (
            <Button
              size="xs"
              variant="ghost"
              shape="square"
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              icon={<XIcon />}
              aria-label={`Borrar ${q.name}`}
              onClick={() => onRemove(q)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function SqlTab({
  target,
  incoming,
  dark,
}: {
  target: Target;
  // "Abrir en SQL" desde una tabla: llega como pestaña nueva.
  incoming?: { sql: string; n: number };
  dark: boolean;
}) {
  const [tabs, setTabs] = useState<QueryTab[]>([
    { id: 1, name: "Consulta 1", text: "select name from sqlite_master where type = 'table'" },
  ]);
  const [active, setActive] = useState(1);
  const nextId = useRef(2);
  const [busy, setBusy] = useState(false);
  const [schema, setSchema] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState<Saved[]>(readSaved);
  const [search, setSearch] = useState("");

  const tab = tabs.find((t) => t.id === active) ?? (tabs[0] as QueryTab);
  const patch = (id: number, p: Partial<QueryTab>) =>
    setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));
  const open = (name: string, text: string) => {
    const id = nextId.current++;
    setTabs((ts) => [...ts, { id, name, text }]);
    setActive(id);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: sólo reacciona a un pedido nuevo
  useEffect(() => {
    if (incoming) open("Desde la tabla", incoming.sql);
  }, [incoming?.n]);

  useEffect(() => {
    completionSchema(target).then(setSchema, () => setSchema({}));
  }, [target]);

  const updateSaved = (list: Saved[]) => {
    setSaved(list);
    writeSaved(list);
  };
  const save = () => {
    const name = window.prompt("Nombre de la consulta", saved.find((q) => q.sql === tab.text)?.name ?? "")?.trim();
    if (!name) return;
    updateSaved([...saved.filter((q) => q.name !== name), { name, sql: tab.text }]);
    patch(tab.id, { name });
  };

  const close = (id: number) => {
    const rest = tabs.filter((t) => t.id !== id);
    if (rest.length === 0) {
      const fresh = nextId.current++;
      setTabs([{ id: fresh, name: `Consulta ${fresh}`, text: "" }]);
      setActive(fresh);
      return;
    }
    const i = tabs.findIndex((t) => t.id === id);
    setTabs(rest);
    if (id === active) setActive((rest[i] ?? rest[i - 1] ?? rest[0])?.id as number);
  };

  const exec = async () => {
    const id = tab.id;
    setBusy(true);
    try {
      patch(id, { result: await query(target, tab.text), error: undefined });
    } catch (e) {
      patch(id, { error: (e as Error).message, result: undefined });
    } finally {
      setBusy(false);
    }
  };

  const q = search.trim().toLowerCase();
  const match = (list: Saved[]) =>
    list.filter((x) => x.name.toLowerCase().includes(q) || x.sql.toLowerCase().includes(q));
  const pick = (x: Saved) => {
    const already = tabs.find((t) => t.text === x.sql);
    if (already) setActive(already.id);
    else open(x.name, x.sql);
  };
  const { result, error } = tab;

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-60 shrink-0 flex-col gap-1 overflow-auto border-r border-kumo-line p-2">
        <div className="flex gap-1">
          <Input
            size="sm"
            className="min-w-0 flex-1"
            aria-label="Buscar consultas"
            placeholder="Buscar consultas"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button
            size="sm"
            shape="square"
            icon={<PlusIcon />}
            aria-label="Consulta nueva"
            onClick={() => open(`Consulta ${nextId.current}`, "")}
          />
        </div>
        <QueryList title="Plantillas" items={match(TEMPLATES)} current={tab.text} onPick={pick} />
        <QueryList
          title="Guardadas"
          items={match(saved)}
          current={tab.text}
          onPick={pick}
          onRemove={(x) => updateSaved(saved.filter((s) => s.name !== x.name))}
        />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-stretch overflow-x-auto border-b border-kumo-line bg-kumo-recessed">
          {tabs.map((t) => (
            <div
              key={t.id}
              className={`group flex items-center gap-1 border-r border-kumo-line pr-1 ${t.id === active ? "bg-kumo-base" : ""}`}
            >
              <button
                type="button"
                className={`py-2 pl-3 text-sm whitespace-nowrap ${t.id === active ? "" : "text-kumo-subtle"}`}
                onClick={() => setActive(t.id)}
              >
                {t.name}
              </button>
              <Button
                size="xs"
                variant="ghost"
                shape="square"
                className={t.id === active ? "" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"}
                icon={<XIcon />}
                aria-label={`Cerrar ${t.name}`}
                onClick={() => close(t.id)}
              />
            </div>
          ))}
        </div>
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
          <span className="text-xs text-kumo-subtle">Tab o Enter aceptan la sugerencia. Ctrl+Espacio la abre.</span>
        </Toolbar>
        <div className="h-2/5 shrink-0 border-b border-kumo-line p-3">
          <SqlEditor
            key={tab.id}
            value={tab.text}
            onChange={(text) => patch(tab.id, { text })}
            onRun={exec}
            schema={schema}
            dark={dark}
          />
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
    </div>
  );
}
