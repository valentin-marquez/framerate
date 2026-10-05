import type { Offer, PricePoint } from "@framerate/contracts";
import { IconArrowsMaximize, IconHelp, IconX } from "@tabler/icons-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/shared/components/primitives/dialog";
import { StoreLogo } from "~/shared/components/store-logo";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { bestOf, type HistoryDay, historyDays, PERIODS, type Period, type PriceKind } from "../utils/price-history";
import { dayLabel, PriceChart, RangeNavigator, type StoreLine, type TourMark } from "./price-chart";

// Colores de las líneas por tienda en pantalla completa: diez distintos, ninguno repetido.
const STORE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#06b6d4",
  "#84cc16",
];

const TOUR_SEEN = "framerate:tutorial-grafico";

const TOUR: { targets: string[]; title: string; text: string; demo?: boolean }[] = [
  {
    targets: ["line"],
    title: "El mejor precio, día a día",
    text: "La línea oscura es el precio más barato con transferencia entre las tiendas con stock. Va en escalones porque el precio cambia de un día a otro; la línea tenue es el precio con tarjeta.",
  },
  {
    targets: ["bounds"],
    title: "El más alto y el más bajo",
    text: "Las líneas punteadas marcan el precio más alto y el más bajo del período. Si hoy está cerca de la verde, es un buen momento.",
  },
  {
    targets: ["line", "tooltip"],
    title: "Lee cualquier día",
    text: "Pasa el mouse o desliza el dedo sobre el gráfico: te dice el precio de ese día y qué tienda lo tenía.",
    demo: true,
  },
  {
    targets: ["periods"],
    title: "Elige el período",
    text: "Compara contra el último mes o hasta los últimos 12 meses.",
  },
  {
    targets: ["expand"],
    title: "Compara tienda por tienda",
    text: "En pantalla completa enciendes la línea de cada tienda, cambias a precio con tarjeta y eliges el tramo con el minimapa.",
  },
];

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  ...rest
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
} & Record<`data-${string}`, string | undefined>) {
  return (
    <fieldset aria-label={label} className={cn("inline-flex min-w-0 rounded-xl bg-secondary p-1", className)} {...rest}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 cursor-pointer whitespace-nowrap rounded-lg px-2.5 py-1 font-medium text-xs transition-colors sm:flex-none",
            o.value === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}

const periodOptions = PERIODS.map((p) => ({ value: p.key as string, label: p.label }));

/** Más bajo y más alto del mejor precio, con su día, y la mediana como precio habitual (desde una semana de datos). */
function stats(days: HistoryDay[], kind: PriceKind) {
  const vals = days.flatMap((d) => {
    const b = bestOf(d, kind);
    return b ? [{ v: b[kind], day: d.day }] : [];
  });
  if (vals.length === 0) return null;
  // Con empates manda el primer día, igual que las líneas punteadas del gráfico.
  const min = vals.reduce((a, b) => (b.v < a.v ? b : a));
  const max = vals.reduce((a, b) => (b.v > a.v ? b : a));
  const sorted = vals.map((x) => x.v).toSorted((a, b) => a - b);
  return { min, max, usual: vals.length >= 7 ? sorted[Math.floor(sorted.length / 2)] : undefined };
}

/**
 * Historial de precios de la ficha: el mejor precio de hoy y cuánto cambió, el gráfico del mejor precio día a día, el
 * resumen del período y dos ayudas: un tutorial que enseña a leerlo y una pantalla completa para comparar tiendas.
 */
export function PriceHistoryPanel({
  productName,
  history,
  offers,
  period,
  now,
  onPeriod,
}: {
  productName: string;
  history: PricePoint[];
  offers: Offer[];
  period: Period;
  now: number;
  onPeriod: (key: string) => void;
}) {
  const days = useMemo(() => historyDays(history, offers, period.days, now), [history, offers, period.days, now]);
  const [step, setStep] = useState<number | null>(null);
  const [full, setFull] = useState(false);
  const [unseen, setUnseen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setUnseen(!localStorage.getItem(TOUR_SEEN));
    } catch {}
  }, []);

  if (days.length === 0) return null;

  const current = step === null ? null : TOUR[step];
  const mark: TourMark = (key) => ({
    "data-tour": key,
    "data-tour-current": current?.targets.includes(key) ? "" : undefined,
  });
  const startTour = () => {
    setStep(0);
    setUnseen(false);
    try {
      localStorage.setItem(TOUR_SEEN, "1");
    } catch {}
  };

  const bests = days.map((d) => bestOf(d, "cash"));
  const today = bests.at(-1);
  const first = bests.find(Boolean);
  const firstDay = days[bests.findIndex(Boolean)]?.day ?? days[0]?.day ?? "";
  const delta = today && first ? today.cash - first.cash : 0;
  const s = stats(days, "cash");
  const followedSince = days[0]?.day ?? "";
  // Unos días de diferencia con el inicio del período no ameritan aviso.
  const coversPeriod = followedSince <= new Date(now - (period.days - 3) * 86_400_000).toISOString().slice(0, 10);

  return (
    <>
      <div
        ref={rootRef}
        data-tour-active={current ? "" : undefined}
        className="relative space-y-4 rounded-2xl border border-border bg-card p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div {...mark("header")} className="min-w-0">
            <p className="text-muted-foreground text-xs">
              {today ? "Mejor precio hoy" : "Hoy ninguna tienda tiene stock"}
            </p>
            {today && (
              <>
                <p className="font-semibold text-2xl text-foreground tabular-nums tracking-tight">
                  {formatCLP(today.cash)}
                </p>
                <p className="text-muted-foreground text-sm">
                  en {today.storeName}
                  {first && (
                    <span
                      className={cn("ml-2 font-medium", delta < 0 && "text-success", delta > 0 && "text-foreground")}
                    >
                      {delta === 0
                        ? `sin cambios desde el ${dayLabel(firstDay)}`
                        : `${delta < 0 ? "bajó" : "subió"} ${formatCLP(Math.abs(delta))} desde el ${dayLabel(firstDay)}`}
                    </span>
                  )}
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={startTour}
              className="relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-muted-foreground text-xs transition-colors hover:bg-secondary hover:text-foreground"
            >
              <IconHelp className="size-4" />
              Cómo leerlo
              {unseen && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 size-1.5 animate-pulse rounded-full bg-primary"
                />
              )}
            </button>
            <button
              type="button"
              {...mark("expand")}
              onClick={() => setFull(true)}
              aria-label="Ver en pantalla completa"
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <IconArrowsMaximize className="size-4" />
            </button>
          </div>
        </div>

        <Segmented
          {...mark("periods")}
          className="flex w-full sm:inline-flex sm:w-auto"
          label="Período"
          options={periodOptions}
          value={period.key}
          onChange={onPeriod}
        />

        <PriceChart
          days={days}
          kind="cash"
          height={220}
          mark={mark}
          demoIndex={current?.demo ? Math.max(0, Math.floor(days.length * 0.6)) : undefined}
        />

        {s && (
          <dl {...mark("stats")} className="grid gap-1.5 text-sm sm:grid-cols-3 sm:gap-2">
            <Stat label="Más bajo" value={s.min?.v} day={s.min?.day} />
            <Stat label="Habitual" value={s.usual} />
            <Stat label="Más alto" value={s.max?.v} day={s.max?.day} />
          </dl>
        )}
        {!coversPeriod && (
          <p {...mark("stats")} className="text-muted-foreground text-xs">
            Lo seguimos desde el {dayLabel(followedSince)}: con más días, los períodos largos se van llenando.
          </p>
        )}

        {current && step !== null && (
          <TourPopover rootRef={rootRef} step={step} onStep={setStep} onClose={() => setStep(null)} />
        )}
      </div>

      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent className="max-h-[94dvh] w-[min(96vw,1180px)] max-w-none overflow-y-auto p-4 sm:p-6">
          <FullHistory
            key={`${period.key}-${days.length}`}
            productName={productName}
            days={days}
            offers={offers}
            period={period}
            onPeriod={onPeriod}
            onClose={() => setFull(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// En teléfono, una línea por dato (etiqueta a la izquierda, valor a la derecha): tres cajas no caben con precios millonarios.
function Stat({ label, value, day }: { label: string; value?: number; day?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2 sm:block">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="ml-auto font-medium text-foreground tabular-nums sm:ml-0">
        {value === undefined ? "Faltan datos" : formatCLP(value)}
      </dd>
      {day && <dd className="text-muted-foreground text-xs">{dayLabel(day)}</dd>}
    </div>
  );
}

/**
 * Burbuja del tutorial: se ubica bajo (o sobre) la primera parte que explica el paso y se desliza al cambiar de paso.
 * Esc cierra; las flechas avanzan y retroceden.
 */
function TourPopover({
  rootRef,
  step,
  onStep,
  onClose,
}: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  step: number;
  onStep: (step: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const s = TOUR[step];
  const last = step === TOUR.length - 1;

  useLayoutEffect(() => {
    const root = rootRef.current;
    const pop = ref.current;
    const target = root?.querySelector(`[data-tour="${s?.targets[0]}"]`);
    if (!root || !pop || !target) return;
    const r = root.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    const h = pop.offsetHeight;
    // Debajo de la parte si cabe en la pantalla (puede salirse del panel); si no, encima; si tampoco, adentro.
    let y = t.bottom - r.top + 10;
    if (t.bottom + 10 + h > window.innerHeight) y = t.top - r.top - h - 10;
    if (t.top - h - 10 < 0 && y < 0) y = Math.min(Math.max(t.top - r.top + 12, 8), r.height - h - 8);
    const x = Math.min(Math.max(t.left - r.left, 8), r.width - pop.offsetWidth - 8);
    setPos({ x, y });
  }, [rootRef, s]);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && !last) onStep(step + 1);
      else if (e.key === "ArrowLeft" && step > 0) onStep(step - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, last, onStep, onClose]);

  if (!s) return null;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Cómo leer el gráfico, paso ${step + 1} de ${TOUR.length}`}
      tabIndex={-1}
      className={cn(
        "absolute top-0 left-0 z-20 w-72 max-w-[calc(100%-16px)] rounded-2xl border border-border bg-card p-4 shadow-xl outline-none transition-transform duration-base ease-in-out",
        pos ? "animate-in fade-in-0 zoom-in-95" : "invisible",
      )}
      style={pos ? { transform: `translate(${pos.x}px, ${pos.y}px)` } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-foreground text-sm">{s.title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar tutorial"
          className="-mt-1 -mr-1 grid size-6 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <IconX className="size-3.5" />
        </button>
      </div>
      <p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">{s.text}</p>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex gap-1" aria-hidden="true">
          {TOUR.map((t, i) => (
            <span
              key={t.title}
              className={cn("h-1.5 rounded-full transition-all", i === step ? "w-4 bg-foreground" : "w-1.5 bg-border")}
            />
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          {step > 0 && (
            <button
              type="button"
              onClick={() => onStep(step - 1)}
              className="h-8 cursor-pointer rounded-lg px-2.5 text-muted-foreground text-xs hover:text-foreground"
            >
              Atrás
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? onClose() : onStep(step + 1))}
            className="h-8 cursor-pointer rounded-lg bg-foreground px-3 font-medium text-background text-xs transition-opacity hover:opacity-85"
          >
            {last ? "Listo" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pantalla completa: precio con transferencia o con tarjeta, líneas por tienda, minimapa del tramo y tabla por tienda. */
function FullHistory({
  productName,
  days,
  offers,
  period,
  onPeriod,
  onClose,
}: {
  productName: string;
  days: HistoryDay[];
  offers: Offer[];
  period: Period;
  onPeriod: (key: string) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<PriceKind>("cash");
  const [range, setRange] = useState<[number, number]>([0, days.length - 1]);
  const [on, setOn] = useState<Set<string>>(new Set());

  const allStores = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of days) for (const st of d.stores) seen.set(st.store, st.storeName);
    return [...seen]
      .toSorted((a, b) => a[1].localeCompare(b[1]))
      .map(
        ([store, storeName], i): StoreLine => ({
          store,
          storeName,
          color: STORE_COLORS[i % STORE_COLORS.length] ?? "#888",
        }),
      );
  }, [days]);
  const icons = new Map(offers.map((o) => [o.store.slug, o.store.iconUrl]));
  const visible = days.slice(range[0], range[1] + 1);
  const lines = allStores.filter((s) => on.has(s.store));

  const rows = allStores
    .map((s) => {
      const vals = visible.flatMap((d) => {
        const st = d.stores.find((x) => x.store === s.store);
        return st?.inStock ? [st[kind]] : [];
      });
      const now = visible.at(-1)?.stores.find((x) => x.store === s.store);
      return {
        ...s,
        today: now?.inStock ? now[kind] : undefined,
        min: vals.length ? Math.min(...vals) : undefined,
        max: vals.length ? Math.max(...vals) : undefined,
      };
    })
    .toSorted((a, b) => (a.today ?? Number.POSITIVE_INFINITY) - (b.today ?? Number.POSITIVE_INFINITY));
  const toggle = (store: string) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (!next.delete(store)) next.add(store);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <DialogTitle>Historial de precios</DialogTitle>
          <DialogDescription className="mt-1 truncate">{productName}</DialogDescription>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <IconX className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Período" options={periodOptions} value={period.key} onChange={onPeriod} />
        <Segmented
          label="Precio"
          options={[
            { value: "cash", label: "Transferencia" },
            { value: "card", label: "Con tarjeta" },
          ]}
          value={kind}
          onChange={setKind}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-muted-foreground text-xs">Comparar con</span>
        {allStores.map((s) => (
          <button
            key={s.store}
            type="button"
            aria-pressed={on.has(s.store)}
            onClick={() => toggle(s.store)}
            className={cn(
              "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2 text-xs transition-colors",
              on.has(s.store)
                ? "border-foreground/30 bg-secondary text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className="size-2 rounded-full transition-opacity"
              style={{ background: s.color, opacity: on.has(s.store) ? 1 : 0.35 }}
            />
            <StoreLogo
              store={{ name: s.storeName, slug: s.store, icon_url: icons.get(s.store) }}
              className="size-4 rounded"
            />
            {s.storeName}
          </button>
        ))}
      </div>

      <PriceChart days={visible} kind={kind} height={360} stores={lines} />
      {days.length >= 7 && <RangeNavigator days={days} kind={kind} range={range} onRange={setRange} />}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] whitespace-nowrap text-sm [&_td+td]:pl-4 [&_th+th]:pl-4">
          <thead>
            <tr className="text-left text-muted-foreground text-xs">
              <th className="py-2 font-normal">Tienda</th>
              <th className="py-2 text-right font-normal">Hoy</th>
              <th className="py-2 text-right font-normal">Más bajo</th>
              <th className="py-2 text-right font-normal">Más alto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.store} className="border-border/60 border-t">
                <td className="py-2">
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: r.color }} />
                    {r.storeName}
                  </span>
                </td>
                <td className="py-2 text-right tabular-nums">
                  {r.today === undefined ? "Sin stock" : formatCLP(r.today)}
                </td>
                <td className="py-2 text-right text-muted-foreground tabular-nums">
                  {r.min === undefined ? "" : formatCLP(r.min)}
                </td>
                <td className="py-2 text-right text-muted-foreground tabular-nums">
                  {r.max === undefined ? "" : formatCLP(r.max)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
