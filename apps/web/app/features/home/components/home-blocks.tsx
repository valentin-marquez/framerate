import { Link } from "react-router";
import { StoreLogo } from "~/shared/components/store-logo";
import type { HomeData } from "../types";

/** Tiendas que se comparan: da confianza y muestra el alcance real del catálogo. */
export function StoresStrip({ stores }: { stores: HomeData["stores"] }) {
  if (stores.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-foreground text-lg tracking-tight md:text-xl">Tiendas que comparamos</h2>
      <ul className="flex flex-wrap gap-3">
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
