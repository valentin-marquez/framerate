import { useEffect, useState } from "react";

/**
 * SSR-safe `matchMedia`. Devuelve `false` en el servidor y en el primer paint;
 * se corrige tras hidratar. Usado para decidir si el campo de búsqueda colapsado
 * va inline en el navbar (desktop) o en una segunda fila (móvil) — y así montar
 * una sola instancia del `layoutId`.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
