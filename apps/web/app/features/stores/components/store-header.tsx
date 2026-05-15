import { IconCircleCheckFilled, IconExternalLink } from "@tabler/icons-react";
import type { StoreDetail } from "../services/stores";

interface StoreHeaderProps {
  store: StoreDetail;
}

export function StoreHeader({ store }: StoreHeaderProps) {
  return (
    <header className="overflow-hidden rounded-2xl border border-border bg-card">
      {store.banner_url ? (
        <div
          className="h-40 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${store.banner_url})` }}
          aria-hidden
        />
      ) : (
        <div className="h-24 w-full bg-gradient-to-br from-primary/10 via-secondary/30 to-transparent" aria-hidden />
      )}
      <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {store.logo_url && (
            <img
              src={store.logo_url}
              alt={`Logo de ${store.name}`}
              className="size-16 rounded-xl border border-border bg-background object-contain p-2"
            />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-2xl">{store.name}</h1>
              {store.verified_at && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs"
                  title={`Verificada el ${new Date(store.verified_at).toLocaleDateString()}`}
                >
                  <IconCircleCheckFilled className="size-3.5" />
                  Verificada
                </span>
              )}
            </div>
            {store.description && <p className="mt-1 max-w-2xl text-muted-foreground text-sm">{store.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
              {store.website && (
                <a
                  href={store.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <IconExternalLink className="size-3.5" />
                  {new URL(store.website).hostname}
                </a>
              )}
              <span>{store.member_count} miembros</span>
              {store.rating.count > 0 && store.rating.average !== null && (
                <span>
                  {store.rating.average.toFixed(1)} ★ ({store.rating.count})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
