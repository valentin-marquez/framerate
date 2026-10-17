import type { ReactNode } from "react";

/**
 * Hueco de una unidad responsiva de AdSense rotulado "Anuncio": toma el ancho que le dé la columna y sólo el alto va
 * reservado, para que el anuncio no empuje la página al llegar. Sin AdSense todavía: sólo se ve en Storybook.
 */
export function AdSlot() {
  return (
    <aside aria-label="Anuncio" className="min-w-0 space-y-1">
      <p className="text-label-xs text-muted-foreground">Anuncio</p>
      <div className="flex h-[100px] items-center justify-center rounded-xl border border-border border-dashed bg-card text-muted-foreground text-paragraph-xs @3xl:h-[90px]">
        Anuncio responsivo
      </div>
    </aside>
  );
}

/**
 * Un bloque y el anuncio a su derecha. Responde al ancho de la columna (con el riel abierto o plegado), no al de la
 * pantalla: si no caben los dos, el anuncio baja.
 */
export function WithAd({ children }: { children: ReactNode }) {
  return (
    <div className="@container">
      <div className="grid gap-4 @3xl:grid-cols-[minmax(0,3fr)_minmax(16rem,2fr)] @3xl:items-end @3xl:gap-8">
        <div className="min-w-0">{children}</div>
        <AdSlot />
      </div>
    </div>
  );
}
