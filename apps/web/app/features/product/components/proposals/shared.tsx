import { CATEGORY_LABELS, CATEGORY_SLUGS, type Offer, type PricePoint, type ProductDetail } from "@framerate/contracts";
import { IconChevronRight, IconPhotoOff } from "@tabler/icons-react";
import { Link } from "react-router";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { cn } from "~/shared/lib/utils";

/** Lo que comparten las tres propuestas: orden de ofertas, textos de stock y tiempo, y la lectura del historial. */

export type PriceKey = "priceCash" | "priceCard";

/** Con stock primero; dentro de cada grupo, por precio. */
export const sortOffers = (offers: Offer[], key: PriceKey = "priceCash") =>
  offers.toSorted((a, b) => Number(b.inStock) - Number(a.inStock) || a[key] - b[key]);

const relative = new Intl.RelativeTimeFormat("es-CL", { numeric: "auto" });

// ponytail: depende del reloj del cliente; en la página real se calcula contra la hora de la respuesta para no
// cambiar al hidratar.
export function seenAgo(iso: string) {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 60) return relative.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  return hours < 24 ? relative.format(-hours, "hour") : relative.format(-Math.round(hours / 24), "day");
}

export function stockText(o: Offer) {
  if (!o.inStock) return "Sin stock";
  return o.stockQuantity && o.stockQuantity <= 5 ? `Quedan ${o.stockQuantity}` : "Con stock";
}

export function StockDot({ inStock, className }: { inStock: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("size-1.5 shrink-0 rounded-full", inStock ? "bg-success" : "bg-foreground/25", className)}
    />
  );
}

const LABELS: Record<string, string> = {
  chipset: "Chip",
  vram: "Memoria",
  line: "Línea",
  oc: "Overclock de fábrica",
  capacity: "Capacidad",
  type: "Tipo",
  speed: "Velocidad",
  interface: "Interfaz",
  rpm: "Velocidad de giro",
  formFactor: "Formato",
  wattage: "Potencia",
  efficiency: "Certificación",
  socket: "Socket",
};
const UNITS: Record<string, string> = { vram: " GB", capacity: " GB", speed: " MHz", rpm: " RPM", wattage: " W" };
const UPPER = new Set(["chipset", "type", "interface", "formFactor", "socket"]);

/** Los atributos que el matching saca del título, como filas legibles. Hoy son la única ficha técnica que hay. */
export function specRows(attributes: ProductDetail["attributes"]): [string, string][] {
  return Object.entries(attributes).map(([key, value]) => {
    const label = LABELS[key] ?? key;
    if (typeof value === "boolean") return [label, value ? "Sí" : "No"];
    if (typeof value === "number") return [label, `${value}${UNITS[key] ?? ""}`];
    if (key === "efficiency") return [label, `80 Plus ${value[0]?.toUpperCase()}${value.slice(1)}`];
    return [label, UPPER.has(key) ? value.toUpperCase() : `${value[0]?.toUpperCase()}${value.slice(1)}`];
  });
}

/**
 * Mejor precio con transferencia al cierre de cada día con datos, arrastrando el último precio de cada tienda (la API
 * guarda un punto cuando el precio cambia, no uno por día).
 */
function dailyBest(points: PricePoint[]) {
  const last = new Map<string, PricePoint>();
  const byDay = new Map<string, number>();
  for (const p of points.toSorted((a, b) => a.observedAt.localeCompare(b.observedAt))) {
    last.set(p.store, p);
    const best = Math.min(...[...last.values()].filter((x) => x.inStock).map((x) => x.priceCash));
    if (Number.isFinite(best)) byDay.set(p.observedAt.slice(0, 10), best);
  }
  return [...byDay.entries()];
}

export type HistorySummary = { min: number; max: number; usual: number; days: number; since: string };

/** null si hay menos de una semana de datos: con menos, "precio habitual" no significa nada. */
export function summarizeHistory(points: PricePoint[]): HistorySummary | null {
  const days = dailyBest(points);
  if (days.length < 7) return null;
  const prices = days.map(([, price]) => price).toSorted((a, b) => a - b);
  return {
    min: prices[0] ?? 0,
    max: prices.at(-1) ?? 0,
    usual: prices[Math.floor(prices.length / 2)] ?? 0,
    days: days.length,
    since: days[0]?.[0] ?? "",
  };
}

export type Verdict = { label: string; tone: "good" | "neutral" | "bad" };

export function priceVerdict(today: number, h: HistorySummary): Verdict {
  if (today <= h.min) return { label: `El precio más bajo en ${h.days} días`, tone: "good" };
  if (today <= h.usual * 1.02) return { label: "En su precio habitual", tone: "neutral" };
  return { label: "Sobre su precio habitual", tone: "bad" };
}

export const shortDate = (isoDay: string) =>
  new Date(`${isoDay}T12:00:00Z`).toLocaleDateString("es-CL", { day: "numeric", month: "long" });

/** La foto sobre el mismo fondo que la tarjeta de producto (blanca en claro, gris en oscuro, con multiply). */
export function ProductPhoto({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-2xl bg-[var(--product-stage)]",
        className,
      )}
    >
      {src ? (
        <AsyncImage src={src} alt={alt} priority className="size-full object-contain p-4 mix-blend-multiply" />
      ) : (
        <IconPhotoOff className="size-10 text-foreground/20" stroke={1.25} role="img" aria-label="Sin imagen" />
      )}
    </div>
  );
}

export function Breadcrumb({ category }: { category: ProductDetail["category"] }) {
  return (
    <nav aria-label="Migas" className="flex items-center gap-1.5 text-muted-foreground text-xs">
      <Link to="/" className="hover:text-foreground">
        Inicio
      </Link>
      <IconChevronRight className="size-3" />
      <Link to={`/categoria/${CATEGORY_SLUGS[category]}`} className="hover:text-foreground">
        {CATEGORY_LABELS[category]}
      </Link>
    </nav>
  );
}
