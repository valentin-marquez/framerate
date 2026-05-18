import { animate, type MotionValue, useMotionValue, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useRef } from "react";

/**
 * Estado del morph como animación ONE-SHOT (no scrubbed): al cruzar el umbral
 * de scroll se dispara una transición de 200ms de `e` 0↔1; por debajo del
 * umbral `e=0` (campo en el hero), por encima `e=1` (campo en el navbar).
 *
 * `e` es un MotionValue eased por el tween → lo consumen `MorphSearch` (lerp
 * de la caja entre ancla A y B) y el navbar (ancho del ancla / alto de la fila
 * móvil). Hay histéresis para que no titile al quedarse justo en el umbral.
 *
 * Dos instancias (MorphSearch y navbar) animan su propio `e` pero con el mismo
 * umbral, duración y easing → curvas idénticas, en sincronía.
 */
const DURATION = 0.2; // 200ms
const EASE = [0.4, 0, 0.2, 1] as const;

export function useMorphState(threshold = 96): MotionValue<number> {
  const e = useMotionValue(0);
  const { scrollY } = useScroll();
  const collapsed = useRef(false);

  const apply = (y: number, animated: boolean) => {
    // Histéresis: colapsa al pasar `threshold`, se expande sólo al bajar de
    // 60% del umbral. Evita el flicker al detenerse justo en el borde.
    const next = collapsed.current ? y > threshold * 0.6 : y > threshold;
    if (next === collapsed.current) return;
    collapsed.current = next;
    if (animated) animate(e, next ? 1 : 0, { duration: DURATION, ease: EASE });
    else e.set(next ? 1 : 0);
  };

  useMotionValueEvent(scrollY, "change", (y) => apply(y, true));

  useEffect(() => {
    // Estado inicial sin animación (p.ej. recarga ya scrolleado).
    const next = window.scrollY > threshold;
    collapsed.current = next;
    e.set(next ? 1 : 0);
  }, [threshold, e]);

  return e;
}
