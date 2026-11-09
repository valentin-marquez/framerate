import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { StoreLogo } from "~/shared/components/store-logo";
import { cn } from "~/shared/lib/utils";
import type { HomeData } from "../types";

type Store = HomeData["stores"][number];

/** Con `compact`, en teléfono es sólo el ícono; desde `md` es igual a las demás: logo, nombre y ofertas. */
function StoreItem({ store, compact }: { store: Store; compact?: boolean }) {
  return (
    <Link
      to={`/tiendas/${store.slug}`}
      prefetch="intent"
      aria-label={compact ? store.name : undefined}
      title={compact ? store.name : undefined}
      className={cn(
        "shrink-0 rounded-2xl border border-border/40 bg-card transition-colors hover:border-primary/40",
        compact
          ? "block size-12 p-1.5 md:flex md:size-auto md:items-center md:gap-2.5 md:py-2 md:pr-4 md:pl-2"
          : "flex items-center gap-2.5 py-2 pr-4 pl-2",
      )}
    >
      <StoreLogo store={store} className={compact ? "size-full rounded-xl md:size-10 md:rounded-lg" : "size-10"} />
      <span className={compact ? "hidden md:block" : undefined}>
        <span className="block font-medium text-foreground text-sm">{store.name}</span>
        <span className="block text-muted-foreground text-xs tabular-nums">
          {(store.offer_count ?? 0).toLocaleString("es-CL")} ofertas
        </span>
      </span>
    </Link>
  );
}

/** Tiendas que se comparan: da confianza y muestra el alcance real del catálogo. */
export function StoresStrip({ stores }: { stores: HomeData["stores"] }) {
  if (stores.length === 0) return null;
  const ranked = stores.toSorted((a, b) => (b.offer_count ?? 0) - (a.offer_count ?? 0));
  // Se reparten por turnos: cada columna tiene tres tiendas seguidas del ranking y de izquierda a derecha bajan las ofertas.
  // En teléfono sólo la fila de arriba lleva el nombre; las otras dos, el ícono.
  const [top, ...others] = [0, 1, 2].map((row) => ranked.filter((_, i) => i % 3 === row));
  return (
    <section className="space-y-3">
      <h2 className="text-foreground text-label-lg md:text-title-h6">Tiendas que comparamos</h2>

      {/* Las tres filas se desplazan juntas; el difuminado de los costados avisa que hay más. */}
      <DragScroll>
        <div className="flex w-max flex-col gap-2 px-4 md:gap-3 md:px-6">
          <div className="flex gap-2 md:gap-3">
            {top.map((store) => (
              <StoreItem key={store.id} store={store} />
            ))}
          </div>
          {others
            .filter((row) => row.length > 0)
            .map((row) => (
              <div key={row[0].id} className="flex gap-2 md:gap-3">
                {row.map((store) => (
                  <StoreItem key={store.id} store={store} compact />
                ))}
              </div>
            ))}
        </div>
      </DragScroll>
    </section>
  );
}

/** Lo que se arrastra antes de dejar de contar como un clic. */
const DRAG_THRESHOLD = 4;

/**
 * Contenedor con scroll horizontal que también se mueve arrastrando con el mouse. En pantallas táctiles, el trackpad
 * o la rueda con Shift, el scroll es el nativo.
 */
function DragScroll({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const s = useRef({ down: false, dragging: false, moved: false, x: 0, from: 0 });
  const [edge, setEdge] = useState({ start: true, end: false });
  const stop = () => {
    s.current.down = false;
    s.current.dragging = false;
  };

  // Las flechas sólo aparecen hacia el lado que todavía tiene tiendas; el estado cambia sólo al cruzar un borde.
  const measure = useCallback(() => {
    const el = box.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const go = (direction: -1 | 1) => {
    const el = box.current;
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: smooth ? "smooth" : "auto" });
  };

  const arrow =
    "absolute top-1/2 z-10 hidden size-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm transition-opacity hover:bg-secondary md:grid";

  return (
    <div className="relative -mx-4 md:mx-0">
      <button
        type="button"
        aria-label="Ver tiendas anteriores"
        tabIndex={edge.start ? -1 : 0}
        onClick={() => go(-1)}
        className={cn(arrow, "left-2", edge.start && "pointer-events-none opacity-0")}
      >
        <IconChevronLeft className="size-5" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Ver más tiendas"
        tabIndex={edge.end ? -1 : 0}
        onClick={() => go(1)}
        className={cn(arrow, "right-2", edge.end && "pointer-events-none opacity-0")}
      >
        <IconChevronRight className="size-5" aria-hidden />
      </button>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: el arrastre es un extra del mouse; por teclado se recorre con los enlaces. */}
      <div
        ref={box}
        onScroll={measure}
        className="cursor-grab select-none overflow-x-auto scrollbar-hide [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] active:cursor-grabbing"
        onPointerDown={(e) => {
          if (e.button !== 0 || e.pointerType !== "mouse" || !box.current) return;
          Object.assign(s.current, {
            down: true,
            dragging: false,
            moved: false,
            x: e.clientX,
            from: box.current.scrollLeft,
          });
        }}
        onPointerMove={(e) => {
          const state = s.current;
          if (!state.down || !box.current) return;
          const dx = e.clientX - state.x;
          if (!state.dragging && Math.abs(dx) > DRAG_THRESHOLD) {
            state.dragging = true;
            state.moved = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          if (state.dragging) box.current.scrollLeft = state.from - dx;
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onClickCapture={(e) => {
          // Soltar después de arrastrar no abre la tienda sobre la que terminó el gesto.
          if (s.current.moved) {
            e.preventDefault();
            e.stopPropagation();
            s.current.moved = false;
          }
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        {children}
      </div>
    </div>
  );
}
