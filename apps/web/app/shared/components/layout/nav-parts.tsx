import { type Freshness, nextCrawlAt } from "@framerate/contracts";
import { IconClock } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "~/shared/lib/utils";
import { formatSpan } from "~/shared/utils/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";

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

const GRADIENTS = {
  morning: "linear-gradient(rgba(255, 183, 77, 0.2) 0%, rgba(255, 213, 79, 0.1) 50%, rgba(249, 230, 203, 0) 100%)",
  afternoon: "linear-gradient(rgba(126, 60, 142, 0.2) 0%, rgba(227, 154, 101, 0.1) 50%, rgba(249, 230, 203, 0) 100%)",
  evening: "linear-gradient(rgba(255, 87, 34, 0.2) 0%, rgba(233, 30, 99, 0.1) 50%, rgba(249, 230, 203, 0) 100%)",
  night: "linear-gradient(rgba(63, 81, 181, 0.2) 0%, rgba(48, 63, 159, 0.1) 50%, rgba(26, 35, 126, 0) 100%)",
};

function timeOfDay(): keyof typeof GRADIENTS {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 21) return "evening";
  return "night";
}

/**
 * Degradado de color en lo alto de la página según la hora local. El servidor no la conoce: se dibuja tras
 * hidratar y entra con un fundido (sólo opacidad); al cambiar de franja, el nuevo entra igual.
 */
export function TimeGradient() {
  const [time, setTime] = useState<keyof typeof GRADIENTS | null>(null);
  useEffect(() => {
    setTime(timeOfDay());
    const id = setInterval(() => setTime(timeOfDay()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!time) return null;
  return (
    <div
      key={time}
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-50 fade-in-0 animate-in duration-700 ease-out"
      style={{ background: GRADIENTS[time] }}
    />
  );
}

/** Hace cuánto se actualizaron las ofertas y cuánto falta para la próxima vuelta. */
function freshnessText({ updatedAt, nextUpdateAt }: Freshness, now: number) {
  // Pasada la hora prevista (riel abierto mucho rato), la cuenta sigue con la vuelta siguiente del cron.
  const next = Date.parse(nextUpdateAt) > now ? Date.parse(nextUpdateAt) : nextCrawlAt(new Date(now)).getTime();
  const last = updatedAt ? Date.parse(updatedAt) : null;
  return {
    updated: last ? `Ofertas actualizadas hace ${formatSpan(now - last)}` : "Ofertas sin actualizar aún",
    next: `Próxima en ${formatSpan(next - now)}`,
    progress: last ? Math.min(1, Math.max(0, (now - last) / (next - last))) : 0,
  };
}

/**
 * Frescura de las ofertas en el pie del riel. El tiempo relativo cambia entre el servidor y el cliente: se calcula
 * sólo en el cliente, una vez por minuto, y el servidor deja el alto reservado para no mover el riel al hidratar.
 */
export function OfferFreshness({ freshness, collapsed }: { freshness: Freshness; collapsed: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const text = now === null ? null : freshnessText(freshness, now);

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={text ? `${text.updated}. ${text.next}` : "Frescura de las ofertas"}
              className="grid size-9 place-items-center rounded-xl text-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          <IconClock className="size-[18px]" stroke={1.75} />
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {text ? (
            <>
              {text.updated}
              <span className="block opacity-70">{text.next}</span>
            </>
          ) : (
            "Ofertas"
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="w-full space-y-1.5 px-1 text-xs">
      <p className="h-4 truncate text-muted-foreground">{text?.updated}</p>
      <div aria-hidden className="h-0.5 overflow-hidden rounded-full bg-border/60">
        <div
          className="h-full origin-left rounded-full bg-foreground/30 transition-transform duration-base"
          style={{ transform: `scaleX(${text?.progress ?? 0})` }}
        />
      </div>
      <p className="h-4 truncate text-foreground/40">{text?.next}</p>
    </div>
  );
}
