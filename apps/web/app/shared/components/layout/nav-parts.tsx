import type { CategoryItem } from "@framerate/contracts";
import { IconSearch } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { Form, NavLink, useLocation, useSearchParams } from "react-router";
import { cn } from "~/shared/lib/utils";

/** Pestaña del navbar: tinta llena si está activa, atenuada si no (el hover la completa). */
export const navTabClass = (active: boolean) =>
  cn(
    "inline-flex h-8 items-center gap-1.5 rounded-lg font-medium text-sm transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? "text-foreground" : "text-foreground/40 hover:text-foreground",
  );

/**
 * Buscador del navbar: un formulario GET a `/buscar`, así funciona antes de hidratar. En `/buscar` muestra la
 * consulta actual. Ctrl+K o `/` lo enfocan.
 */
export function NavSearch({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const query = pathname === "/buscar" ? (params.get("q") ?? "") : "";
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Form action="/buscar" role="search" className={cn("relative", className)}>
      <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        // La key resetea el valor al cambiar la consulta en la URL (atrás/adelante, otra búsqueda).
        key={query}
        ref={inputRef}
        name="q"
        type="search"
        defaultValue={query}
        placeholder="Buscar productos"
        aria-label="Buscar productos"
        enterKeyHint="search"
        autoComplete="off"
        className="peer h-9 w-full rounded-xl border border-border/60 bg-card pr-3 pl-9 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground hover:border-primary/40 focus:border-primary lg:pr-16"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 font-mono text-[10px] text-muted-foreground peer-focus:opacity-0 lg:inline">
        Ctrl K
      </kbd>
    </Form>
  );
}

/** Segunda fila del navbar: todas las categorías a la vista. En móvil se desliza en horizontal. */
export function NavCategories({ categories }: { categories: CategoryItem[] }) {
  if (categories.length === 0) return null;
  return (
    <nav aria-label="Categorías" className="scrollbar-hide overflow-x-auto px-4">
      <ul className="flex h-10 w-max items-center gap-5 md:mx-auto">
        {categories.map((c) => (
          <li key={c.id}>
            <NavLink
              to={`/categoria/${c.slug}`}
              prefetch="intent"
              viewTransition
              className={({ isActive }) => cn(navTabClass(isActive), "whitespace-nowrap")}
            >
              {c.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
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
