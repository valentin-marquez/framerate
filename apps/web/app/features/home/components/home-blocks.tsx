import { Link } from "react-router";
import { StoreLogo } from "~/shared/components/store-logo";
import type { HomeData } from "../types";

/** Las que van arriba, con nombre y cifra; el resto va abajo, sólo con el ícono. */
const TOP = 12;

/** Tiendas que se comparan: da confianza y muestra el alcance real del catálogo. */
export function StoresStrip({ stores }: { stores: HomeData["stores"] }) {
  if (stores.length === 0) return null;
  const ranked = stores.toSorted((a, b) => (b.offer_count ?? 0) - (a.offer_count ?? 0));
  const top = ranked.slice(0, TOP);
  const rest = ranked.slice(TOP);
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-foreground text-lg tracking-tight md:text-xl">Tiendas que comparamos</h2>

      {/* Teléfono: dos filas que avanzan solas. Segundos por celda: ~28 px/s arriba (se alcanza a leer) y ~45 abajo. */}
      <div className="-mx-4 space-y-2 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] md:hidden">
        <Marquee seconds={top.length * 5.5}>
          {top.map((store) => (
            <Link
              key={store.id}
              to={`/tiendas/${store.slug}`}
              prefetch="intent"
              className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-border/40 bg-card py-2 pr-4 pl-2"
            >
              <StoreLogo store={store} className="size-10" />
              <span>
                <span className="block font-medium text-foreground text-sm">{store.name}</span>
                <span className="block text-muted-foreground text-xs tabular-nums">
                  {(store.offer_count ?? 0).toLocaleString("es-CL")} ofertas
                </span>
              </span>
            </Link>
          ))}
        </Marquee>
        {rest.length > 0 && (
          <Marquee seconds={rest.length * 1.25}>
            {rest.map((store) => (
              <Link
                key={store.id}
                to={`/tiendas/${store.slug}`}
                prefetch="intent"
                aria-label={store.name}
                className="block size-12 shrink-0 rounded-2xl border border-border/40 bg-card p-1.5"
              >
                <StoreLogo store={store} className="size-full rounded-xl" />
              </Link>
            ))}
          </Marquee>
        )}
      </div>

      <ul className="hidden flex-wrap gap-3 md:flex">
        {stores.map((store) => (
          <li key={store.id}>
            <Link
              to={`/tiendas/${store.slug}`}
              prefetch="intent"
              className="flex items-center gap-2.5 rounded-2xl border border-border/40 bg-card py-2 pr-4 pl-2 transition-colors hover:border-primary/40"
            >
              <StoreLogo store={store} className="size-9" />
              <span className="font-medium text-foreground text-sm">{store.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Una fila que avanza sola hacia la izquierda: dos copias seguidas y, al llegar a la mitad, vuelve al inicio sin que
 * se note. Se detiene al tocarla o con foco; con movimiento reducido queda quieta y se recorre a mano.
 */
function Marquee({ children, seconds }: { children: React.ReactNode; seconds: number }) {
  return (
    <div className="group overflow-hidden motion-reduce:overflow-x-auto motion-reduce:scrollbar-hide">
      <div
        className="stores-marquee flex w-max group-focus-within:[animation-play-state:paused] group-active:[animation-play-state:paused]"
        style={{ "--marquee-duration": `${seconds}s` } as React.CSSProperties}
      >
        <div className="flex gap-2 pr-2">{children}</div>
        {/* La copia sólo completa el bucle: fuera del árbol de accesibilidad y del orden de tabulación. */}
        <div aria-hidden inert className="flex gap-2 pr-2 motion-reduce:hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
