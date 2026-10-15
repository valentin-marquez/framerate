import { IconLoader2, IconSearch, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useNavigation, useSearchParams } from "react-router";
import { cn } from "~/shared/lib/utils";

const DEBOUNCE_MS = 250;

/** Enfoca el buscador visible: el navbar monta uno en el riel y otro en la barra del teléfono. */
export function focusSearchField() {
  [...document.querySelectorAll<HTMLInputElement>("input[data-search-field]")]
    .find((el) => el.offsetParent !== null)
    ?.focus();
}

const stopSpotlight = () => delete document.documentElement.dataset.searchSpotlight;

/**
 * Foco de atención (Ctrl+K): mientras el campo está vacío, el contenido se desenfoca y se atenúa (ver
 * `[data-search-spotlight]` en app.css). Se levanta al escribir, al salir del campo o con Esc.
 */
export function startSearchSpotlight() {
  const input = [...document.querySelectorAll<HTMLInputElement>("input[data-search-field]")].find(
    (el) => el.offsetParent !== null,
  );
  if (input && !input.value) document.documentElement.dataset.searchSpotlight = "true";
}

/**
 * Buscador que filtra mientras se escribe: tras una pausa corta lleva a `/buscar?q=` y la página de resultados se
 * actualiza en su lugar (como el buscador de 21st). La primera búsqueda deja una entrada en el historial; las
 * siguientes la reemplazan, así "atrás" no recorre letra por letra. Sin JS es un formulario GET normal.
 */
export function SearchField({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const onResults = pathname === "/buscar";
  const urlQuery = onResults ? (params.get("q") ?? "") : "";

  const [value, setValue] = useState(urlQuery);
  // La última consulta que mandó este campo: cuando la URL llega a ella no se pisa lo que se siguió escribiendo.
  const sent = useRef(urlQuery);
  useEffect(() => {
    if (urlQuery !== sent.current) {
      sent.current = urlQuery;
      setValue(urlQuery);
    }
  }, [urlQuery]);

  const search = (raw: string) => {
    const q = raw.trim();
    if (q === sent.current && onResults) return;
    sent.current = q;
    // En /buscar se conservan los filtros (marca, orden) y se vuelve a la primera página.
    const next = new URLSearchParams(onResults ? params : undefined);
    next.delete("page");
    if (q) next.set("q", q);
    else next.delete("q");
    const query = next.toString();
    navigate(`/buscar${query ? `?${query}` : ""}`, { replace: onResults, preventScrollReset: onResults });
  };

  useEffect(() => {
    const typed = value.trim();
    // Sin texto fuera de /buscar no hay nada que buscar; en /buscar, vaciarlo muestra todo el catálogo.
    if (typed === sent.current || (!typed && !onResults)) return;
    const id = setTimeout(() => search(value), DEBOUNCE_MS);
    return () => clearTimeout(id);
  });

  const loading = navigation.state === "loading" && navigation.location.pathname === "/buscar";

  return (
    <form
      action="/buscar"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        search(value);
      }}
    >
      <span
        aria-hidden="true"
        data-active={loading}
        className="beam pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-xl"
      >
        <span className="beam-glow" />
        <span className="beam-line" />
      </span>
      {/* El giro va en el ícono y la escala del cruce en su envoltorio: las dos usan transform. */}
      <span className="t-icon-swap pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
        <IconSearch data-on={!loading} className="size-4 text-muted-foreground" />
        <span data-on={loading}>
          <IconLoader2 className={cn("size-4 text-foreground", loading && "animate-spin")} />
        </span>
      </span>
      <input
        data-search-field
        type="search"
        name="q"
        aria-label="Buscar productos"
        autoComplete="off"
        enterKeyHint="search"
        placeholder="Buscar modelo o marca"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (e.target.value) stopSpotlight();
        }}
        onBlur={stopSpotlight}
        onKeyDown={(e) => {
          if (e.key === "Escape") e.currentTarget.blur();
        }}
        className="h-10 w-full rounded-xl border border-border/70 bg-background pr-9 pl-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-foreground/20 focus:border-foreground/30 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {/* Siempre montado para que entre y salga con escala, no de golpe. */}
      <button
        type="button"
        aria-label="Borrar búsqueda"
        aria-hidden={!value}
        tabIndex={value ? 0 : -1}
        onClick={() => {
          setValue("");
          focusSearchField();
        }}
        className={cn(
          "absolute top-1/2 right-2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-muted-foreground",
          "transition-[opacity,scale,background-color,color] duration-fast ease-out hover:bg-secondary hover:text-foreground",
          value ? "scale-100 opacity-100" : "pointer-events-none scale-50 opacity-0",
        )}
      >
        <IconX className="size-3.5" stroke={2} />
      </button>
    </form>
  );
}
