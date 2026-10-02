import { domAnimation, LazyMotion, m } from "motion/react";
import { useRef, useState } from "react";
import { DURATION, EASE_IN_OUT } from "~/shared/lib/motion";

export function Logo({ className, isHovered }: { className?: string; isHovered?: boolean }) {
  // El rotation se incrementa exactamente una vez por cada transición false→true.
  // Antes esto vivía dentro de un useEffect (no-effect-event-handler): el cambio
  // se computa ahora durante el render para responder al cambio de prop como si
  // fuera un evento, sin agendar un re-render extra.
  const [rotation, setRotation] = useState(0);
  const prevHoveredRef = useRef(isHovered);

  if (isHovered && !prevHoveredRef.current) {
    prevHoveredRef.current = true;
    setRotation((prev) => prev + 360);
  } else if (!isHovered && prevHoveredRef.current) {
    prevHoveredRef.current = false;
  }

  return (
    <LazyMotion features={domAnimation}>
      {/* Grilla de 16: a 16 px cada hueco cae en un píxel entero. Las formas no se superponen, así que con
          opacidad (pie) ninguna zona se pinta dos veces. */}
      <m.svg viewBox="0 0 16 16" width="16" height="16" xmlns="http://www.w3.org/2000/svg" className={className}>
        <title>Framerate</title>
        <path d="M0 0H16V5H5V16H0ZM6 6H16V11H11V16H6Z" fill="currentColor" />
        <m.rect
          x="12"
          y="12"
          width="4"
          height="4"
          fill="currentColor"
          animate={{ rotate: rotation }}
          transition={{ duration: DURATION.slow, ease: EASE_IN_OUT }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      </m.svg>
    </LazyMotion>
  );
}
