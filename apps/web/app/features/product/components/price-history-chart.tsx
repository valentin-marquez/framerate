import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PriceHistoryResponse, PriceHistorySeries } from "~/features/product/services/products";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";

const STORE_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];

interface PriceHistoryChartProps {
  data: PriceHistoryResponse;
  className?: string;
}

interface NormalizedPoint {
  t: number; // timestamp ms
  price: number;
  series: string;
  color: string;
  store_name: string;
  store_logo_url: string | null;
}

const PADDING = { top: 16, right: 16, bottom: 28, left: 56 };
const HEIGHT = 240;

// react-doctor-disable-next-line no-giant-component -- breaking into focused components is a separate task, tracked
export function PriceHistoryChart({ data, className }: PriceHistoryChartProps) {
  const { t, lang } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  // width=0 hasta que medimos el contenedor. Importante: el SVG no debe forzar
  // el ancho del padre (overflow-hidden + render condicional), porque si nace con
  // un width grande hace overflow del layout en mobile.
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = () => {
      const w = node.clientWidth;
      if (w > 0) setWidth(w);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const enrichedSeries = useMemo(() => {
    // react-doctor-disable-next-line js-combine-iterations -- micro-optimization not worth losing readability
    return data.series
      .filter((s) => s.points.length > 0)
      .map((s, i) => ({
        ...s,
        color: STORE_COLORS[i % STORE_COLORS.length],
      }));
  }, [data.series]);

  const stats = useMemo(() => {
    const allPoints: NormalizedPoint[] = [];
    for (const s of enrichedSeries) {
      for (const p of s.points) {
        allPoints.push({
          t: new Date(p.recorded_at).getTime(),
          price: p.price_cash,
          series: s.store_slug,
          color: s.color,
          store_name: s.store_name,
          store_logo_url: s.store_logo_url,
        });
      }
    }
    if (allPoints.length === 0) {
      return null;
    }

    const minT = Math.min(...allPoints.map((p) => p.t));
    const maxT = Math.max(...allPoints.map((p) => p.t));
    const minP = Math.min(...allPoints.map((p) => p.price));
    const maxP = Math.max(...allPoints.map((p) => p.price));

    // Padding del eje Y para que la línea no toque los bordes (10% arriba/abajo).
    const range = maxP - minP || 1;
    const yMin = Math.max(0, minP - range * 0.1);
    const yMax = maxP + range * 0.1;

    // Trend: comparamos primer y último precio agregado (mediana entre series por instante).
    const earliest = allPoints.reduce((a, b) => (a.t <= b.t ? a : b));
    const latest = allPoints.reduce((a, b) => (a.t >= b.t ? a : b));
    const delta = latest.price - earliest.price;
    const pct = earliest.price > 0 ? (delta / earliest.price) * 100 : 0;

    return { allPoints, minT, maxT, yMin, yMax, minP, earliest, latest, delta, pct };
  }, [enrichedSeries]);

  // Must be before early return to satisfy Rules of Hooks.
  const hoveredPoints = useMemo(() => {
    if (hoverX == null || !stats) return [];
    const { minT, maxT, yMin, yMax } = stats;
    const innerW = Math.max(width - PADDING.left - PADDING.right, 0);
    const innerH = HEIGHT - PADDING.top - PADDING.bottom;
    const xScaleLocal = (t: number) =>
      maxT === minT ? PADDING.left + innerW / 2 : PADDING.left + ((t - minT) / (maxT - minT)) * innerW;
    const yScaleLocal = (price: number) =>
      yMax === yMin ? PADDING.top + innerH / 2 : PADDING.top + (1 - (price - yMin) / (yMax - yMin)) * innerH;
    const tHover = minT + ((hoverX - PADDING.left) / innerW) * (maxT - minT);
    // react-doctor-disable-next-line js-combine-iterations -- map's type narrowing + final filter type predicate is clearer than a manual for-loop
    return enrichedSeries
      .map((s) => {
        if (s.points.length === 0) return null;
        let nearest = s.points[0];
        let nearestDiff = Math.abs(new Date(nearest.recorded_at).getTime() - tHover);
        for (const p of s.points) {
          const d = Math.abs(new Date(p.recorded_at).getTime() - tHover);
          if (d < nearestDiff) {
            nearest = p;
            nearestDiff = d;
          }
        }
        return {
          color: s.color,
          store_name: s.store_name,
          point: nearest,
          x: xScaleLocal(new Date(nearest.recorded_at).getTime()),
          y: yScaleLocal(nearest.price_cash),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }, [hoverX, enrichedSeries, stats, width]);

  if (!stats) return null;

  const { minT, maxT, yMin, yMax, minP, delta, pct } = stats;

  const innerW = Math.max(width - PADDING.left - PADDING.right, 0);
  const innerH = HEIGHT - PADDING.top - PADDING.bottom;

  const xScale = (t: number) => {
    if (maxT === minT) return PADDING.left + innerW / 2;
    return PADDING.left + ((t - minT) / (maxT - minT)) * innerW;
  };
  const yScale = (price: number) => {
    if (yMax === yMin) return PADDING.top + innerH / 2;
    return PADDING.top + (1 - (price - yMin) / (yMax - yMin)) * innerH;
  };

  // Genera el path SVG para una serie (line). Si solo hay 1 punto, dibuja un círculo.
  const buildPath = (series: PriceHistorySeries) => {
    if (series.points.length === 0) return "";
    const sorted = series.points.toSorted(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );
    return sorted
      .map((p, i) => {
        const x = xScale(new Date(p.recorded_at).getTime());
        const y = yScale(p.price_cash);
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  };

  // Eje Y: 4 ticks equiespaciados.
  const yTicks = Array.from({ length: 4 }, (_, i) => yMin + ((yMax - yMin) * i) / 3);

  // Eje X: 4 ticks. Si el rango total es < 48h usamos hora porque la fecha repetida
  // no aporta nada; si no, usamos día/mes.
  const locale = lang === "en" ? "en-US" : "es-CL";
  const rangeMs = maxT - minT;
  const useHourTicks = rangeMs > 0 && rangeMs < 48 * 60 * 60 * 1000;
  const formatDate = (ts: number) =>
    useHourTicks
      ? new Date(ts).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
      : new Date(ts).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const xTicks = Array.from({ length: 4 }, (_, i) => minT + ((maxT - minT) * i) / 3);

  const hoverDate = hoveredPoints[0] ? new Date(hoveredPoints[0].point.recorded_at) : null;

  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    if (x < PADDING.left || x > PADDING.left + innerW) {
      setHoverX(null);
      return;
    }
    setHoverX(x);
  };

  const TrendIcon = delta < 0 ? IconTrendingDown : IconTrendingUp;
  const trendColor =
    delta < 0
      ? "text-emerald-600 dark:text-emerald-400"
      : delta > 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <div ref={containerRef} className={cn("relative w-full overflow-hidden", className)}>
      {/* Header: trend resumen */}
      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("price_history_window", { days: data.days })}
          </span>
          {Math.abs(pct) >= 0.5 && (
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium", trendColor)}>
              <TrendIcon className="size-3.5" />
              {delta < 0 ? "−" : "+"}
              {Math.abs(pct).toFixed(1)}% ({delta < 0 ? "−" : "+"}
              {formatCLP(Math.abs(delta))})
            </span>
          )}
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {enrichedSeries.map((s) => (
            <span key={s.store_slug} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              {s.store_name}
            </span>
          ))}
        </div>
      </div>

      <div className="relative" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={t("price_history")}
            onMouseMove={onMouseMove}
            onMouseLeave={() => setHoverX(null)}
            className="block max-w-full"
          >
            <title>{t("price_history")}</title>

            {/* Gridlines horizontales */}
            {yTicks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PADDING.left}
                  x2={PADDING.left + innerW}
                  y1={yScale(tick)}
                  y2={yScale(tick)}
                  className="stroke-border/40"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <text
                  x={PADDING.left - 8}
                  y={yScale(tick)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px] tabular-nums"
                >
                  {formatCLP(Math.round(tick))}
                </text>
              </g>
            ))}

            {/* Ticks eje X */}
            {xTicks.map((tick) => (
              <text
                key={tick}
                x={xScale(tick)}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {formatDate(tick)}
              </text>
            ))}

            {/* Líneas por serie */}
            {enrichedSeries.map((s) => (
              <g key={s.store_slug}>
                <path
                  d={buildPath(s)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {/* Si la serie tiene solo 1 punto, dibujar círculo */}
                {s.points.length === 1 && (
                  // react-doctor-disable-next-line rendering-hydration-mismatch-time -- parsing fixed recorded_at to ms; getTime() is locale/timezone-independent
                  <circle
                    cx={xScale(new Date(s.points[0].recorded_at).getTime())}
                    cy={yScale(s.points[0].price_cash)}
                    r={3.5}
                    fill={s.color}
                  />
                )}
              </g>
            ))}

            {/* Línea vertical hover + puntos destacados */}
            {hoverX != null && (
              <>
                <line
                  x1={hoverX}
                  x2={hoverX}
                  y1={PADDING.top}
                  y2={PADDING.top + innerH}
                  className="stroke-border"
                  strokeWidth={1}
                />
                {hoveredPoints.map((hp) => (
                  <circle
                    key={hp.store_name}
                    cx={hp.x}
                    cy={hp.y}
                    r={4}
                    fill={hp.color}
                    stroke="var(--background)"
                    strokeWidth={2}
                  />
                ))}
              </>
            )}
          </svg>
        )}

        {/* Tooltip flotante */}
        {hoverX != null && hoveredPoints.length > 0 && hoverDate && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-border/60 bg-card/95 backdrop-blur-md px-3 py-2 text-xs shadow-lg"
            style={{
              left: Math.min(Math.max(hoverX, 80), width - 80),
              top: 0,
            }}
          >
            <div className="mb-1.5 font-medium text-foreground">
              {hoverDate.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
            </div>
            <div className="space-y-1">
              {hoveredPoints.map((hp) => (
                <div key={hp.store_name} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full" style={{ background: hp.color }} />
                    {hp.store_name}
                  </span>
                  <span className="font-medium text-foreground tabular-nums">{formatCLP(hp.point.price_cash)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer: low marker */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {t("price_history_min")} <span className="font-medium text-foreground tabular-nums">{formatCLP(minP)}</span>
        </span>
      </div>
    </div>
  );
}
