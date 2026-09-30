import type { Icon } from "@tabler/icons-react";
import { useSyncExternalStore } from "react";
import { Link } from "react-router";
import { cn } from "~/shared/lib/utils";

/** Pestaña del navbar: tinta llena si está activa, atenuada si no (el hover la completa). */
export const navTabClass = (active: boolean) =>
  cn(
    "inline-flex h-8 items-center gap-1.5 rounded-lg font-medium text-sm transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? "text-foreground" : "text-foreground/40 hover:text-foreground",
  );

interface NavTabProps {
  to: string;
  icon: Icon;
  label: string;
  active: boolean;
  /** Oculta el texto (sólo el ícono), p. ej. en móvil. */
  iconOnly?: boolean;
}

export function NavTab({ to, icon: TabIcon, label, active, iconOnly }: NavTabProps) {
  return (
    <Link
      to={to}
      prefetch="intent"
      aria-current={active ? "page" : undefined}
      aria-label={iconOnly ? label : undefined}
      className={navTabClass(active)}
    >
      <TabIcon className="size-4" stroke={1.75} />
      {!iconOnly && <span>{label}</span>}
    </Link>
  );
}

const formatter = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZoneName: "shortOffset",
});

function subscribeToMinute(onChange: () => void) {
  const timer = setInterval(onChange, 15_000);
  return () => clearInterval(timer);
}

const santiagoTime = () =>
  formatter
    .formatToParts(new Date())
    .filter((p) => p.type === "hour" || p.type === "minute" || p.type === "timeZoneName" || p.type === "literal")
    .map((p) => p.value)
    .join("")
    .replace(/\s+/, " ");

/**
 * Hora de Santiago. El servidor no sabe la hora del visitante: se dibuja vacía con el ancho reservado
 * y el cliente la completa, así no mueve nada al hidratar.
 */
export function NavClock({ className }: { className?: string }) {
  const time = useSyncExternalStore(subscribeToMinute, santiagoTime, () => "");
  return (
    <span
      className={cn("inline-block min-w-[10ch] text-right text-foreground/40 text-sm tabular-nums", className)}
      suppressHydrationWarning
    >
      {time}
    </span>
  );
}
