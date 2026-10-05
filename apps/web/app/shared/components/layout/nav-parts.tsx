import { useEffect, useRef, useState } from "react";
import { cn } from "~/shared/lib/utils";

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
