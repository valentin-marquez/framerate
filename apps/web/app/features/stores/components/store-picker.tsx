import { IconLoader2, IconSearch, IconShieldCheck } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Input } from "~/shared/components/primitives/input";
import { StoreLogo } from "~/shared/components/store-logo";
import { type ClaimableStore, storesService } from "../services/stores";

interface StorePickerProps {
  /** Se invoca al elegir una tienda reclamable (con dominio y no reclamada). */
  onSelect: (store: ClaimableStore) => void;
  /** Deshabilita la interacción mientras se crea el claim. */
  busy?: boolean;
}

/**
 * Paso 1 del flujo de "reclamar tienda": en vez de pedir un dominio y un UUID
 * a mano, la persona busca su tienda en el catálogo. El dominio y el store_id
 * salen de la selección — nunca se tipean.
 */
export function StorePicker({ onSelect, busy }: StorePickerProps) {
  const [query, setQuery] = useState("");
  const [stores, setStores] = useState<ClaimableStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await storesService.listClaimable(query.trim() || undefined);
        if (!cancelled) setStores(res.stores);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <IconSearch className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Buscá tu tienda… (ej: PC Express)"
          value={query}
          disabled={busy}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="max-h-80 overflow-y-auto rounded-xl border border-border/40 bg-background">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground text-sm">
            <IconLoader2 className="size-4 animate-spin" />
            Cargando tiendas…
          </div>
        ) : error ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No se pudieron cargar las tiendas. Reintentá en unos segundos.
          </div>
        ) : stores.length === 0 ? (
          <EmptyState query={query} />
        ) : (
          <ul className="divide-y divide-border/40">
            {stores.map((store) => (
              <StoreRow key={store.id} store={store} busy={busy} onSelect={onSelect} />
            ))}
          </ul>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        Elegí la tienda que te pertenece. Verificamos la propiedad con un registro DNS de su dominio.
      </p>
    </div>
  );
}

function StoreRow({
  store,
  busy,
  onSelect,
}: {
  store: ClaimableStore;
  busy?: boolean;
  onSelect: (s: ClaimableStore) => void;
}) {
  const claimed = store.is_claimed;
  const noDomain = !store.domain;
  const disabled = busy || claimed || noDomain;

  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(store)}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
      >
        <StoreLogo store={store} className="size-9" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-sm">{store.name}</div>
          <div className="truncate text-muted-foreground text-xs">{store.domain ?? "sin dominio verificable"}</div>
        </div>
        {claimed ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary/60 px-2 py-0.5 text-muted-foreground text-xs">
            <IconShieldCheck className="size-3.5" />
            Ya reclamada
          </span>
        ) : noDomain ? (
          <span className="shrink-0 rounded-full bg-secondary/60 px-2 py-0.5 text-muted-foreground text-xs">
            No disponible
          </span>
        ) : (
          <span className="shrink-0 text-muted-foreground text-xs">Reclamar →</span>
        )}
      </button>
    </li>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="space-y-1 p-8 text-center">
      <p className="font-medium text-sm">
        {query ? `Sin resultados para "${query}"` : "No hay tiendas en el catálogo"}
      </p>
      <p className="text-muted-foreground text-xs">
        ¿Tu tienda todavía no está en Framerate? Escribinos a{" "}
        <a
          href="mailto:soporte@framerate.com?subject=Quiero%20sumar%20mi%20tienda"
          className="text-primary hover:underline"
        >
          soporte@framerate.com
        </a>{" "}
        y la sumamos al catálogo.
      </p>
    </div>
  );
}
