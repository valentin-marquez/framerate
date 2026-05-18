import { IconArrowRight, IconSearch } from "@tabler/icons-react";
import { domAnimation, LazyMotion, m, useMotionValue, useMotionValueEvent, useScroll } from "motion/react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useMediaQuery } from "~/shared/hooks/use-media-query";
import { useMorphState } from "~/shared/hooks/use-morph-state";

/** Alto del campo en cada extremo del morph. */
const HERO_H = 56; // origen (ancla A en el hero)
const NAV_H = 36; // destino (ancla B en el navbar)

/**
 * Ancho final del campo (= ancho del ancla B). Compartido con el navbar para
 * que el ancla que separa Explorar/Hardware y el campo flotante coincidan.
 */
export function navTargetWidth(vw: number, isDesktop: boolean): number {
  if (!vw) return 320;
  return isDesktop ? Math.max(256, Math.min(vw * 0.26, 360)) : Math.max(220, vw - 32);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Controlador único del buscador: UN solo campo `position: fixed` cuya caja se
 * interpola entre dos anclas invisibles, `#hero-search-anchor` (hero) y
 * `#nav-search-anchor` (navbar / fila móvil). El driver `e` es ONE-SHOT: por
 * debajo del umbral el campo sigue al hero; al cruzarlo se dispara la animación
 * de 200ms que lo coloca arriba (y de vuelta al subir). No es scrubbed. Sólo
 * activo en la landing ("/").
 */
export function MorphSearch() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const navigate = useNavigate();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const e = useMorphState();
  const { scrollY } = useScroll();
  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);

  // x/y como transform (GPU) y width/height/radius numéricos.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const width = useMotionValue(0);
  const height = useMotionValue(HERO_H);
  const radius = useMotionValue(16);

  const measure = useCallback(() => {
    const a = document.getElementById("hero-search-anchor");
    const b = document.getElementById("nav-search-anchor");
    if (!a || !b) return;
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const vw = window.innerWidth;
    // `k` = factor del morph (0 = hero, 1 = navbar). Lo anima el tween one-shot
    // de useMorphState, no el scroll. Mientras k=0 el campo sigue al ancla A
    // (que scrollea con la página); al cruzar el umbral k→1 en 200ms.
    const k = clamp01(e.get());
    const heroW = ra.width || Math.min(672, vw - 32);
    const navW = navTargetWidth(vw, isDesktop);
    const w = lerp(heroW, navW, k);
    // cx interpolado hacia el centro del viewport → trayectoria recta (sube y
    // comprime simétrico), sin depender de los anchos de Explorar/Hardware.
    const cx = lerp(ra.left + heroW / 2, vw / 2, k);
    x.set(cx - w / 2);
    y.set(lerp(ra.top, rb.top, k));
    width.set(w);
    height.set(lerp(HERO_H, NAV_H, k));
    radius.set(lerp(16, 12, k));
    if (!ready) setReady(true);
  }, [e, isDesktop, ready, x, y, width, height, radius]);

  // Re-mide cuando anima el morph (cambia `e`) y mientras k=0 al scrollear
  // (para seguir al ancla A que se mueve con la página).
  useMotionValueEvent(e, "change", measure);
  useMotionValueEvent(scrollY, "change", measure);

  useEffect(() => {
    if (!isHome) return;
    let raf = 0;
    let count = 0;
    // Re-mide durante el primer ~1s para captar el settle de layout/imágenes,
    // luego sólo en scroll (evento de progress) y resize.
    const loop = () => {
      measure();
      if (count++ < 60) raf = requestAnimationFrame(loop);
    };
    loop();
    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("load", measure);
    };
  }, [isHome, measure]);

  if (!isHome) return null;

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    const q = query.trim();
    navigate(q ? `/explorar?search=${encodeURIComponent(q)}` : "/explorar");
  };

  return (
    <LazyMotion features={domAnimation}>
      <m.form
        onSubmit={onSubmit}
        style={{ x, y, width, height, borderRadius: radius, opacity: ready ? 1 : 0 }}
        className="fixed left-0 top-0 z-[60] flex items-center bg-card border border-border/60 shadow-sm overflow-hidden transition-colors focus-within:border-primary"
      >
        <IconSearch className="absolute left-4 size-[18px] text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="¿Qué componente buscas? Ej: RTX 4070, Ryzen 7…"
          aria-label="Buscar productos"
          className="h-full w-full bg-transparent pl-12 pr-12 text-[15px] text-secondary-foreground placeholder:text-muted-foreground outline-none"
        />
        <button
          type="submit"
          aria-label="Buscar"
          className="absolute right-2 flex items-center justify-center size-7 rounded-lg bg-secondary/40 text-secondary-foreground/70 transition-colors duration-200 hover:bg-primary hover:text-primary-foreground"
        >
          <IconArrowRight className="size-4" />
        </button>
      </m.form>
    </LazyMotion>
  );
}
