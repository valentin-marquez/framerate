import type { Icon } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
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

/**
 * Fotogramas por segundo de esta pestaña. Cuenta cuadros con requestAnimationFrame y escribe el texto una vez por
 * segundo, sin setState por cuadro. El servidor lo dibuja vacío con el ancho reservado, así no mueve nada al hidratar.
 */
export function NavFps({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      frames++;
      const elapsed = now - last;
      if (elapsed >= 1000) {
        // Tras una pestaña en segundo plano el intervalo es enorme y la lectura saldría en 0: se descarta.
        if (elapsed < 2000) el.textContent = `${Math.round((frames * 1000) / elapsed)} FPS`;
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={cn("inline-block min-w-[7ch] text-right text-foreground/40 text-sm tabular-nums", className)}
    />
  );
}
