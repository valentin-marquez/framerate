import { useCallback } from "react";
import { useSearchParams } from "react-router";

/** Actualiza la URL (fuente de verdad de los filtros) y vuelve a la primera página. */
export function useFilterParams() {
  const [params, setParams] = useSearchParams();
  const update = useCallback(
    (changes: Record<string, string | string[] | null>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(changes)) {
        next.delete(key);
        // Un arreglo es un parámetro repetible (`spec=vram:12&spec=vram:16`).
        for (const v of [value ?? []].flat()) if (v !== "") next.append(key, v);
      }
      next.delete("page");
      setParams(next, { preventScrollReset: true });
    },
    [params, setParams],
  );
  return { params, update };
}

export const specValue = (token: string, key: string) =>
  token.startsWith(`${key}:`) ? token.slice(key.length + 1) : null;
