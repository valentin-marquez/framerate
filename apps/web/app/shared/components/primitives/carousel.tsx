import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { createContext, type ReactNode, type RefObject, use, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "~/shared/lib/utils";

/**
 * Carrusel sobre scroll nativo con imán (scroll-snap): el dedo y el trackpad desplazan con la inercia del sistema y
 * no pelean con los enlaces de las tarjetas. Con mouse se arrastra (y un arrastre no cuenta como clic); las flechas
 * avanzan una vista completa.
 */
type CarouselContextType = {
  scroller: RefObject<HTMLDivElement | null>;
  canPrev: boolean;
  canNext: boolean;
  page: number;
  pages: number;
  disableDrag: boolean;
  scrollByPage: (direction: 1 | -1) => void;
  scrollToPage: (page: number) => void;
  sync: () => void;
};

/** Cuánto sigue un lanzamiento: distancia = velocidad al soltar (px/ms) × esto. Más alto, más lejos llega. */
const FLING_MS = 320;

const CarouselContext = createContext<CarouselContextType | undefined>(undefined);

function useCarousel() {
  const context = use(CarouselContext);
  if (!context) throw new Error("useCarousel must be used within a Carousel");
  return context;
}

export type CarouselProps = {
  children: ReactNode;
  className?: string;
  disableDrag?: boolean;
};

function Carousel({ children, className, disableDrag = false }: CarouselProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ canPrev: false, canNext: false, page: 0, pages: 1 });

  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = {
      canPrev: el.scrollLeft > 4,
      canNext: el.scrollLeft < max - 4,
      page: el.clientWidth ? Math.round(el.scrollLeft / el.clientWidth) : 0,
      pages: el.clientWidth ? Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth - 0.05)) : 1,
    };
    setState((prev) =>
      prev.canPrev === next.canPrev &&
      prev.canNext === next.canNext &&
      prev.page === next.page &&
      prev.pages === next.pages
        ? prev
        : next,
    );
  }, []);

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const el = scroller.current;
    el?.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  }, []);

  const scrollToPage = useCallback((page: number) => {
    const el = scroller.current;
    el?.scrollTo({ left: page * el.clientWidth, behavior: "smooth" });
  }, []);

  return (
    <CarouselContext value={{ scroller, ...state, disableDrag, scrollByPage, scrollToPage, sync }}>
      {/* Se mide al primer puntero o foco y no al montar: leer scrollWidth al hidratar forzaba el layout de todas las
          filas de la home, incluso las que content-visibility se salta (566 ms en un teléfono de gama baja). */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: los eventos sólo miden el carrusel, no son una interacción. */}
      <div className={cn("group/hover relative", className)} onPointerEnter={sync} onFocus={sync}>
        {children}
      </div>
    </CarouselContext>
  );
}

export type CarouselContentProps = {
  children: ReactNode;
  className?: string;
};

function CarouselContent({ children, className }: CarouselContentProps) {
  const { scroller, sync, disableDrag } = useCarousel();
  const drag = useRef<{ x: number; left: number; moved: boolean; samples: { x: number; t: number }[] } | null>(null);

  // Estado de flechas e indicador con el scroll (pasivo, una vez por cuadro); el resto, al entrar el puntero o el foco.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
    };
  }, [scroller, sync]);

  const endDrag = (el: HTMLDivElement) => {
    // Lanzamiento: la velocidad de los últimos ~100 ms proyecta hasta dónde llegaría con fricción, y el scroll
    // nativo (suave, en el compositor) lo lleva hasta ahí; con el imán de vuelta, se asienta en la tarjeta más cercana.
    const samples = drag.current?.moved ? drag.current.samples : [];
    const first = samples[0];
    const last = samples[samples.length - 1];
    const velocity = first && last && last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
    el.style.scrollSnapType = "";
    el.style.scrollBehavior = "";
    drag.current = null;
    if (Math.abs(velocity) > 0.2) el.scrollBy({ left: -velocity * FLING_MS, behavior: "smooth" });
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: los eventos de puntero sólo implementan el arrastre con mouse.
    <div
      ref={scroller}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: zona con scroll enfocable para desplazarla con el teclado.
      tabIndex={0}
      className={cn(
        "scrollbar-hide flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !disableDrag && "md:cursor-grab md:active:cursor-grabbing",
        className,
      )}
      // Las imágenes y enlaces se arrastrarían como archivos: el arrastre es del carrusel.
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (disableDrag || e.pointerType !== "mouse" || e.button !== 0) return;
        drag.current = {
          x: e.clientX,
          left: e.currentTarget.scrollLeft,
          moved: false,
          samples: [{ x: e.clientX, t: e.timeStamp }],
        };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        d.samples.push({ x: e.clientX, t: e.timeStamp });
        while (d.samples.length > 2 && e.timeStamp - d.samples[0].t > 100) d.samples.shift();
        if (!d.moved && Math.abs(dx) < 3) return;
        if (!d.moved) {
          d.moved = true;
          // Sin imán mientras se arrastra: si no, el navegador corrige la posición en cada movimiento.
          e.currentTarget.style.scrollSnapType = "none";
          e.currentTarget.style.scrollBehavior = "auto";
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        e.currentTarget.scrollLeft = d.left - dx;
      }}
      onPointerUp={(e) => {
        const moved = drag.current?.moved;
        endDrag(e.currentTarget);
        if (moved) {
          // Un arrastre no es un clic: se descarta el click que el navegador dispara al soltar. Si se soltó fuera del
          // carrusel no llega ninguno, así que el filtro expira en el mismo ciclo y no se come el clic siguiente.
          const swallow = (click: MouseEvent) => {
            click.preventDefault();
            click.stopPropagation();
          };
          window.addEventListener("click", swallow, { capture: true, once: true });
          setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
        }
      }}
      onPointerCancel={(e) => endDrag(e.currentTarget)}
    >
      {children}
    </div>
  );
}

export type CarouselItemProps = {
  children: ReactNode;
  className?: string;
};

function CarouselItem({ children, className }: CarouselItemProps) {
  return <div className={cn("w-full min-w-0 shrink-0 grow-0 snap-start", className)}>{children}</div>;
}

export type CarouselNavigationProps = {
  className?: string;
  classNameButton?: string;
  alwaysShow?: boolean;
};

function CarouselNavigation({ className, classNameButton, alwaysShow }: CarouselNavigationProps) {
  const { canPrev, canNext, scrollByPage } = useCarousel();
  const button = cn(
    "pointer-events-auto size-fit rounded-full border border-border bg-background p-2 transition-[opacity,scale] duration-300 hover:bg-accent hover:text-accent-foreground active:scale-95",
    alwaysShow ? "opacity-100" : "opacity-0 group-hover/hover:opacity-100 focus-visible:opacity-100",
    "disabled:pointer-events-none disabled:opacity-0",
    classNameButton,
  );
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-1/2 left-[-12.5%] z-10 flex w-[125%] -translate-y-1/2 justify-between px-2",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Anterior"
        className={button}
        disabled={!canPrev}
        onClick={() => scrollByPage(-1)}
      >
        <IconChevronLeft className="stroke-foreground" size={16} />
      </button>
      <button
        type="button"
        aria-label="Siguiente"
        className={button}
        disabled={!canNext}
        onClick={() => scrollByPage(1)}
      >
        <IconChevronRight className="stroke-foreground" size={16} />
      </button>
    </div>
  );
}

export type CarouselIndicatorProps = {
  className?: string;
  classNameButton?: string;
};

function CarouselIndicator({ className, classNameButton }: CarouselIndicatorProps) {
  const { page, pages, scrollToPage } = useCarousel();
  if (pages < 2) return null;
  return (
    <div className={cn("absolute bottom-0 z-10 flex w-full items-center justify-center", className)}>
      <div className="flex gap-x-2">
        {Array.from({ length: pages }, (_, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: las páginas son posiciones, no datos.
            key={i}
            type="button"
            aria-label={`Ir a la página ${i + 1}`}
            onClick={() => scrollToPage(i)}
            className={cn(
              "size-2 rounded-full transition-opacity duration-300",
              page === i ? "bg-primary" : "bg-primary/50",
              classNameButton,
            )}
          />
        ))}
      </div>
    </div>
  );
}

export { Carousel, CarouselContent, CarouselIndicator, CarouselItem, CarouselNavigation, useCarousel };
