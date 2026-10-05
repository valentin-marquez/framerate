import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { bestOf, type HistoryDay, niceTicks, type PriceKind } from "../utils/price-history";

export type StoreLine = { store: string; storeName: string; color: string };

/** Atributos del tutorial (`data-tour`) para cada parte del gráfico; sin tutorial, nada. */
export type TourMark = (key: string) => Record<string, string | undefined>;
const noMark: TourMark = () => ({});

const PAD = { top: 12, right: 12, bottom: 26, left: 76 };
const KIND_LABEL: Record<PriceKind, string> = { cash: "Transferencia", card: "Con tarjeta" };

export const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("es-CL", { timeZone: "UTC", ...opts });

/** Escalones: cada día es un tramo horizontal; sin dato (nadie con stock) se corta. */
function stepPath(vals: (number | undefined)[], x: (i: number) => number, y: (v: number) => number) {
  let d = "";
  let open = false;
  vals.forEach((v, i) => {
    if (v === undefined) {
      open = false;
      return;
    }
    d += `${open ? "V" : "M"}${open ? y(v).toFixed(1) : `${x(i).toFixed(1)},${y(v).toFixed(1)}`}H${x(i + 1).toFixed(1)}`;
    open = true;
  });
  return d;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  // 0 hasta medir: el SVG no debe imponer su ancho al padre, o desborda en el teléfono.
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const ro = new ResizeObserver(() => setWidth(node.clientWidth));
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Mejor precio de cada día en escalones, con el otro precio (tarjeta o transferencia) tenue debajo, el más alto y el
 * más bajo punteados, el precio de hoy en el borde derecho y, opcional, una línea por tienda. Al pasar el mouse o el
 * dedo se lee el día: la burbuja va arriba para que el dedo no la tape.
 */
export function PriceChart({
  days,
  kind,
  height,
  stores = [],
  demoIndex,
  mark = noMark,
  className,
}: {
  days: HistoryDay[];
  kind: PriceKind;
  height: number;
  stores?: StoreLine[];
  /** Tutorial: muestra la lectura de un día sin que nadie pase el mouse. */
  demoIndex?: number;
  mark?: TourMark;
  className?: string;
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const other: PriceKind = kind === "cash" ? "card" : "cash";
  const n = days.length;

  const g = useMemo(() => {
    const main = days.map((d) => bestOf(d, kind));
    const second = days.map((d) => bestOf(d, other)?.[other]);
    const lines = stores.map((s) =>
      days.map((d) => {
        const st = d.stores.find((x) => x.store === s.store);
        return st?.inStock ? st[kind] : undefined;
      }),
    );
    const mainVals = main.map((m) => m?.[kind]);
    const all = [...mainVals, ...second, ...lines.flat()].filter((v): v is number => v !== undefined);
    if (all.length === 0 || width === 0) return null;

    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const pad = (hi - lo) * 0.15 || hi * 0.02;
    const ticks = niceTicks(lo - pad, hi + pad);
    const yMin = ticks[0] ?? lo;
    const yMax = ticks.at(-1) ?? hi;
    const innerW = Math.max(width - PAD.left - PAD.right, 1);
    const innerH = height - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (i / n) * innerW;
    const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * innerH;

    const defined = mainVals.flatMap((v, i) => (v === undefined ? [] : [{ v, i }]));
    const minP = defined.reduce((a, b) => (b.v < a.v ? b : a), defined[0]);
    const maxP = defined.reduce((a, b) => (b.v > a.v ? b : a), defined[0]);
    const line = stepPath(mainVals, x, y);
    // Área bajo la línea: el mismo trazo cerrado contra el piso en cada tramo continuo.
    const area = line.replace(/M([\d.]+),([\d.]+)((?:[VH][\d.]+)*)/g, (_, mx, my, rest) => {
      const end = rest.match(/H([\d.]+)(?!.*H)/)?.[1] ?? mx;
      return `M${mx},${PAD.top + innerH}V${my}${rest}H${end}V${PAD.top + innerH}Z`;
    });
    const labelCount = Math.min(n, width < 520 ? 3 : 5);
    const xLabels = [
      ...new Set(Array.from({ length: labelCount }, (_, k) => Math.round((k * (n - 1)) / Math.max(labelCount - 1, 1)))),
    ];
    const today = mainVals[n - 1];

    return {
      main,
      mainVals,
      lines: lines.map((l) => stepPath(l, x, y)),
      lineVals: lines,
      second: stepPath(second, x, y),
      secondVals: second,
      line,
      area,
      ticks,
      x,
      y,
      innerW,
      innerH,
      minP,
      maxP,
      xLabels,
      today,
    };
  }, [days, kind, other, stores, width, height, n]);

  const shown = hover ?? demoIndex ?? null;
  const at = shown ?? 0;
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!g) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - rect.left - PAD.left) / g.innerW) * n);
    setHover(i >= 0 && i < n ? i : null);
  };

  const cx = g && shown !== null ? g.x(shown) + g.innerW / n / 2 : 0;
  const shownMain = g && shown !== null ? g.main[shown] : undefined;
  const shownDay = shown !== null ? days[shown] : undefined;

  return (
    <div ref={ref} className={cn("relative w-full", className)} style={{ height }}>
      {g ? (
        <>
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`Mejor precio ${KIND_LABEL[kind].toLowerCase()} entre ${dayLabel(days[0]?.day ?? "")} y hoy: de ${formatCLP(g.minP?.v ?? 0)} a ${formatCLP(g.maxP?.v ?? 0)}.`}
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setHover(null)}
            className="block touch-pan-y select-none"
          >
            <g {...mark("grid")}>
              {g.ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={PAD.left}
                    x2={PAD.left + g.innerW}
                    y1={g.y(tick)}
                    y2={g.y(tick)}
                    className="stroke-border/60"
                  />
                  <text
                    x={PAD.left - 8}
                    y={g.y(tick)}
                    dy="0.32em"
                    textAnchor="end"
                    className="fill-muted-foreground text-[10px] tabular-nums"
                  >
                    {formatCLP(tick)}
                  </text>
                </g>
              ))}
              {g.xLabels.map((i, k) => (
                <text
                  key={i}
                  x={g.x(i) + g.innerW / n / 2}
                  y={height - 8}
                  textAnchor={k === 0 ? "start" : k === g.xLabels.length - 1 ? "end" : "middle"}
                  className="fill-muted-foreground text-[10px]"
                >
                  {i === n - 1 ? "hoy" : dayLabel(days[i]?.day ?? "")}
                </text>
              ))}
            </g>

            {g.minP && g.maxP && (
              <g {...mark("bounds")} className="text-[10px]">
                {[g.maxP, ...(g.minP.v !== g.maxP.v ? [g.minP] : [])].map((p, k) => (
                  <g key={p.v}>
                    <line
                      x1={PAD.left}
                      x2={PAD.left + g.innerW}
                      y1={g.y(p.v)}
                      y2={g.y(p.v)}
                      strokeDasharray="4 4"
                      className={k === 0 ? "stroke-warn" : "stroke-success"}
                    />
                    <text
                      x={PAD.left + 6}
                      y={g.y(p.v)}
                      dy={k === 0 ? "-0.45em" : "1.15em"}
                      className="fill-muted-foreground tabular-nums"
                    >
                      {g.minP?.v === g.maxP?.v
                        ? "mismo precio todo el período"
                        : `${k === 0 ? "más alto" : "más bajo"} ${formatCLP(p.v)}, ${dayLabel(days[p.i]?.day ?? "")}`}
                    </text>
                  </g>
                ))}
              </g>
            )}

            <g {...mark("line")}>
              <path d={g.second} fill="none" strokeWidth={1.5} className="stroke-muted-foreground/40" />
              {g.lines.map((d, k) => (
                <path
                  key={stores[k]?.store}
                  d={d}
                  fill="none"
                  strokeWidth={1.5}
                  stroke={stores[k]?.color}
                  opacity={0.85}
                />
              ))}
              <path d={g.area} className="fill-foreground/[0.04]" />
              <path d={g.line} fill="none" strokeWidth={2.25} strokeLinejoin="round" className="stroke-foreground" />
            </g>

            {shown !== null && (
              <g pointerEvents="none">
                <line x1={cx} x2={cx} y1={PAD.top} y2={PAD.top + g.innerH} className="stroke-foreground/30" />
                {g.lineVals.map(
                  (vals, k) =>
                    vals[shown] !== undefined && (
                      <circle key={stores[k]?.store} cx={cx} cy={g.y(vals[shown] ?? 0)} r={3} fill={stores[k]?.color} />
                    ),
                )}
                {g.mainVals[shown] !== undefined && (
                  <circle
                    cx={cx}
                    cy={g.y(g.mainVals[shown] ?? 0)}
                    r={4.5}
                    strokeWidth={2}
                    className="fill-foreground stroke-card"
                  />
                )}
              </g>
            )}
          </svg>

          {g.today !== undefined && (
            <span
              {...mark("line")}
              className="pointer-events-none absolute right-0 -translate-y-1/2 rounded-md bg-foreground px-1.5 py-0.5 font-medium text-[10px] text-background tabular-nums"
              style={{ top: g.y(g.today) }}
            >
              {formatCLP(g.today)}
            </span>
          )}

          {shownDay && (
            <div
              {...mark("tooltip")}
              className="pointer-events-none absolute top-0 z-10 min-w-40 -translate-x-1/2 rounded-xl border border-border/60 bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur-md"
              style={{ left: Math.min(Math.max(cx, 90), width - 90) }}
            >
              <p className="text-muted-foreground">
                {at === n - 1 ? "Hoy" : dayLabel(shownDay.day, { weekday: "short", day: "numeric", month: "short" })}
              </p>
              {shownMain ? (
                <>
                  <p className="font-semibold text-foreground text-sm tabular-nums">{formatCLP(shownMain[kind])}</p>
                  <p className="text-muted-foreground">en {shownMain.storeName}</p>
                </>
              ) : (
                <p className="font-medium text-foreground">Ninguna tienda con stock</p>
              )}
              {g.secondVals[at] !== undefined && (
                <p className="mt-1 text-muted-foreground tabular-nums">
                  {KIND_LABEL[other]} {formatCLP(g.secondVals[at] ?? 0)}
                </p>
              )}
              {stores.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 border-border/60 border-t pt-1.5">
                  {stores.map((s, k) => (
                    <li key={s.store} className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <span className="size-2 rounded-full" style={{ background: s.color }} />
                        {s.storeName}
                      </span>
                      <span className="text-foreground tabular-nums">
                        {g.lineVals[k]?.[at] === undefined ? "sin stock" : formatCLP(g.lineVals[k]?.[at] ?? 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      ) : (
        width > 0 && (
          <p className="grid h-full place-items-center text-muted-foreground text-sm">
            Ninguna tienda tuvo stock en este tramo.
          </p>
        )
      )}
    </div>
  );
}

/**
 * Minimapa del período completo con una ventana para elegir el tramo que muestra el gráfico grande: se arrastra la
 * ventana o sus bordes (también con las flechas del teclado), o se toca fuera para llevarla ahí.
 */
export function RangeNavigator({
  days,
  kind,
  range,
  onRange,
}: {
  days: HistoryDay[];
  kind: PriceKind;
  range: [number, number];
  onRange: (range: [number, number]) => void;
}) {
  const n = days.length;
  const drag = useRef<{ mode: "a" | "b" | "body"; from: number; start: [number, number] } | null>(null);
  const vals = days.map((d) => bestOf(d, kind)?.[kind]);
  const defined = vals.filter((v): v is number => v !== undefined);
  const lo = Math.min(...defined);
  const hi = Math.max(...defined);
  const path = stepPath(
    vals,
    (i) => (i / n) * 100,
    (v) => 4 + (1 - (v - lo) / (hi - lo || 1)) * 32,
  );
  const [a, b] = range;
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

  const indexAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return clamp(Math.floor(((e.clientX - rect.left) / rect.width) * n), 0, n - 1);
  };
  const move = (mode: "a" | "b" | "body", i: number, from: number, start: [number, number]) => {
    if (mode === "a") onRange([clamp(i, 0, start[1] - 1), start[1]]);
    else if (mode === "b") onRange([start[0], clamp(i, start[0] + 1, n - 1)]);
    else {
      const shift = clamp(i - from, -start[0], n - 1 - start[1]);
      onRange([start[0] + shift, start[1] + shift]);
    }
  };
  const handleKeys = (side: "a" | "b") => (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    move(side, (side === "a" ? a : b) + step, 0, range);
  };

  return (
    <div
      className="relative h-10 cursor-pointer touch-pan-y select-none rounded-lg bg-secondary/60"
      onPointerDown={(e) => {
        const target = (e.target as HTMLElement).dataset.part as "a" | "b" | "body" | undefined;
        const i = indexAt(e);
        let start = range;
        if (!target) {
          // Fuera de la ventana: se centra ahí y desde ahí se arrastra.
          const half = Math.floor((b - a) / 2);
          const na = clamp(i - half, 0, n - 1 - (b - a));
          start = [na, na + (b - a)];
          onRange(start);
        }
        drag.current = { mode: target ?? "body", from: i, start };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d) move(d.mode, indexAt(e), d.from, d.start);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
        <path
          d={path}
          fill="none"
          strokeWidth={1.25}
          vectorEffect="non-scaling-stroke"
          className="stroke-muted-foreground"
        />
      </svg>
      <div
        data-part="body"
        className="absolute inset-y-0 cursor-grab rounded-lg border border-foreground/30 bg-foreground/[0.06] active:cursor-grabbing"
        style={{ left: `${(a / n) * 100}%`, width: `${((b - a + 1) / n) * 100}%` }}
      >
        {(["a", "b"] as const).map((side) => (
          <span
            key={side}
            data-part={side}
            role="slider"
            tabIndex={0}
            aria-label={side === "a" ? "Inicio del tramo" : "Fin del tramo"}
            aria-valuemin={0}
            aria-valuemax={n - 1}
            aria-valuenow={side === "a" ? a : b}
            aria-valuetext={dayLabel(days[side === "a" ? a : b]?.day ?? "")}
            onKeyDown={handleKeys(side)}
            className={cn(
              "absolute inset-y-1.5 w-1.5 cursor-ew-resize rounded-full bg-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              side === "a" ? "-left-0.75" : "-right-0.75",
            )}
          />
        ))}
      </div>
    </div>
  );
}
