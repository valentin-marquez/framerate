import { Banner, Button, Chart, ChartPalette, LayerCard, TimeseriesChart } from "@cloudflare/kumo";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { BarChart, LineChart } from "echarts/charts";
import { BrushComponent, GridComponent, ToolboxComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { lastDays } from "../format";
import type { Target } from "../targets";
import { objects, query } from "./api";

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, BrushComponent, ToolboxComponent, CanvasRenderer]);

// Las consultas de /prod-health, agrupadas por día UTC (así las guarda la base).
const SQL = {
  totals: `select (select count(*) from products) productos,
    (select count(*) from listings where is_active = 1) ofertas,
    (select count(*) from listings where is_active = 1 and in_stock = 1) con_stock,
    (select count(*) from match_reviews where status = 'pending') revisiones,
    (select count(*) from quarantine) cuarentena`,
  listings: `select substr(first_seen_at, 1, 10) d, count(*) n from listings
    where first_seen_at >= date('now', '-30 days') group by 1 order by 1`,
  runs: `select substr(started_at, 1, 10) d, status, count(*) n from crawl_runs
    where started_at >= date('now', '-30 days') group by 1, 2 order by 1`,
  quarantine: "select reason, count(*) n from quarantine group by 1 order by n desc limit 10",
  ai: `select substr(at, 1, 10) d, round(sum(usd), 4) usd from ai_usage
    where at >= date('now', '-30 days') group by 1 order by 1`,
};

type Data = { [K in keyof typeof SQL]: Record<string, unknown>[] };

const dayTick = (ts: number) =>
  new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(ts);
const int = (n: number) => Math.round(n).toLocaleString("es-CL");

const RUN_STATUS: Record<string, { label: string; color: "Success" | "Attention" | "Neutral" }> = {
  succeeded: { label: "Exitosas", color: "Success" },
  failed: { label: "Fallidas", color: "Attention" },
  running: { label: "En curso", color: "Neutral" },
};

function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {note && <span className="text-xs text-kumo-subtle">{note}</span>}
      </div>
      <LayerCard className="p-3">{children}</LayerCard>
    </section>
  );
}

export function Home({ target, dark }: { target: Target; dark: boolean }) {
  const [data, setData] = useState<Data>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const keys = Object.keys(SQL) as (keyof typeof SQL)[];
      const results = await Promise.all(keys.map((k) => query(target, SQL[k])));
      setData(Object.fromEntries(keys.map((k, i) => [k, objects(results[i] as never)])) as Data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [target]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = data?.totals[0] ?? {};
  const tiles: [string, string, unknown][] = [
    ["Productos", "en el catálogo", totals.productos],
    ["Ofertas activas", "en tiendas", totals.ofertas],
    ["Con stock", "ofertas disponibles", totals.con_stock],
    ["Revisiones", "de matching pendientes", totals.revisiones],
    ["Cuarentena", "ofertas rechazadas", totals.cuarentena],
  ];
  const runs = Object.entries(RUN_STATUS)
    .map(([status, s]) => ({
      name: s.label,
      color: ChartPalette.semantic(s.color, dark),
      data: lastDays(
        (data?.runs ?? []).filter((r) => r.status === status),
        "n",
        30,
      ),
    }))
    .filter((s) => s.data.some(([, v]) => v > 0));
  const reasons = [...(data?.quarantine ?? [])].reverse();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="flex items-center justify-between gap-2 border-b border-kumo-line px-6 py-3">
        <div>
          <h1 className="text-base font-semibold">Inicio</h1>
          <p className="text-xs text-kumo-subtle">
            Estado de {target === "remote" ? "producción" : "la base local"}. Días en UTC, últimos 30.
          </p>
        </div>
        <Button size="sm" icon={<ArrowClockwiseIcon />} loading={loading} onClick={load}>
          Refrescar
        </Button>
      </div>
      <div className="flex flex-col gap-6 p-6">
        {error && <Banner variant="error" title="No se pudo armar el tablero" description={error} />}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {tiles.map(([label, hint, value]) => (
            <LayerCard key={label} className="flex flex-col gap-1 p-4">
              <span className="text-sm text-kumo-subtle">{label}</span>
              <span className="text-3xl font-semibold tabular-nums">
                {value === undefined ? "…" : int(Number(value))}
              </span>
              <span className="text-xs text-kumo-subtle">{hint}</span>
            </LayerCard>
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Ofertas nuevas por día" note="primera vez que se vieron">
            <TimeseriesChart
              echarts={echarts}
              isDarkMode={dark}
              type="bar"
              height={260}
              loading={!data}
              yAxisMinInterval={1}
              xAxisTickFormat={dayTick}
              tooltipValueFormat={int}
              yAxisTickFormat={int}
              ariaDescription="Ofertas nuevas por día en los últimos 30 días"
              data={[
                {
                  name: "Ofertas nuevas",
                  color: ChartPalette.categorical(0, dark),
                  data: lastDays(data?.listings ?? [], "n", 30),
                },
              ]}
            />
          </Panel>
          <Panel title="Corridas de scraping por día" note={runs.map((r) => r.name).join(", ")}>
            <TimeseriesChart
              echarts={echarts}
              isDarkMode={dark}
              type="bar"
              height={260}
              loading={!data}
              yAxisMinInterval={1}
              xAxisTickFormat={dayTick}
              tooltipValueFormat={int}
              yAxisTickFormat={int}
              ariaDescription="Corridas por día y estado"
              data={runs}
            />
          </Panel>
          <Panel title="Cuarentena por motivo" note="los 10 más frecuentes">
            <Chart
              echarts={echarts}
              isDarkMode={dark}
              height={300}
              options={{
                backgroundColor: "transparent",
                grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
                tooltip: { trigger: "item", valueFormatter: (v) => int(Number(v)) },
                xAxis: {
                  type: "value",
                  splitLine: { lineStyle: { opacity: 0.25 } },
                  axisLabel: { formatter: (v: number) => int(v) },
                },
                yAxis: {
                  type: "category",
                  data: reasons.map((r) => String(r.reason)),
                  axisLabel: { fontFamily: "JetBrains Mono Variable, monospace", fontSize: 11 },
                },
                series: [
                  {
                    type: "bar",
                    data: reasons.map((r) => Number(r.n)),
                    barMaxWidth: 16,
                    itemStyle: { color: ChartPalette.categorical(0, dark), borderRadius: [0, 4, 4, 0] },
                    label: {
                      show: true,
                      position: "right",
                      color: ChartPalette.text("primary", dark),
                      formatter: (p: { value: unknown }) => int(Number(p.value)),
                    },
                  },
                ],
              }}
            />
          </Panel>
          <Panel title="Gasto de IA por día" note="normalize y match, en USD">
            <TimeseriesChart
              echarts={echarts}
              isDarkMode={dark}
              type="bar"
              height={260}
              loading={!data}
              xAxisTickFormat={dayTick}
              tooltipValueFormat={(v) => `US$ ${v.toFixed(2)}`}
              yAxisTickFormat={(v) => `$${v}`}
              ariaDescription="Gasto diario de IA en dólares"
              data={[
                {
                  name: "Gasto",
                  color: ChartPalette.categorical(1, dark),
                  data: lastDays(data?.ai ?? [], "usd", 30),
                },
              ]}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
