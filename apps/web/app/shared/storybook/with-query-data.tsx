import type { Decorator } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { useState } from "react";

/** Marca una consulta que nunca responde, para ver el estado de carga. */
export const LOADING = Symbol("loading");

/**
 * En Storybook no hay API: la historia trae las respuestas ya en caché (con la forma que devuelven los servicios, tras
 * los adaptadores). Cada historia tiene su propio cliente, así dos historias con la misma clave no se pisan.
 */
export const withQueryData =
  (entries: [QueryKey, unknown][]): Decorator =>
  (Story) => {
    const [client] = useState(() => {
      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
      });
      for (const [queryKey, data] of entries) {
        if (data === LOADING) qc.prefetchQuery({ queryKey, queryFn: () => new Promise(() => {}) });
        else qc.setQueryData(queryKey, data);
      }
      return qc;
    });
    return (
      <QueryClientProvider client={client}>
        <Story />
      </QueryClientProvider>
    );
  };
