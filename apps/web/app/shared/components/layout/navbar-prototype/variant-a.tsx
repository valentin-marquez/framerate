// PROTOTIPO (#108) A "Isla": arriba sólo marca y cuenta; la navegación es una píldora flotante abajo, al
// alcance del pulgar (Superbar, la barra de búsqueda de iOS). Al enfocar, la píldora se vuelve buscador y el
// panel se abre hacia arriba (interacción de @nitishkmrk: los segmentos se pliegan en una X).
import type { CategoryItem } from "@framerate/contracts";
import { IconCategory, IconSearch, IconX } from "@tabler/icons-react";
import { cn } from "~/shared/lib/utils";
import { UserMenu } from "../user-menu";
import { Brand, KeyHints, QuoteAction } from "./shared";
import { inputProps, SuggestionGroups } from "./suggestion-row";
import { useNavSearch } from "./use-nav-search";

export const name = "Isla";

export function VariantA({ categories }: { categories: CategoryItem[] }) {
  const search = useNavSearch(categories);

  return (
    <>
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <Brand />
        <UserMenu />
      </div>

      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-black/45 transition-opacity duration-base",
          search.open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-3 md:bottom-6">
        <div className="pointer-events-auto relative w-full max-w-xl">
          {search.open && (
            <div className="absolute inset-x-0 bottom-full mb-2 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-2xl fade-in-0 slide-in-from-bottom-3 zoom-in-[0.98] animate-in duration-fast">
              <div className="max-h-[min(60dvh,32rem)] overflow-y-auto p-2">
                <SuggestionGroups search={search} dense />
              </div>
              <KeyHints />
            </div>
          )}

          <form
            action="/buscar"
            onSubmit={(e) => {
              e.preventDefault();
              search.submit();
            }}
            className="relative flex h-14 items-center rounded-full border border-border/60 bg-card p-1.5 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.35)]"
          >
            <IconSearch className="pointer-events-none absolute left-5 size-5 text-muted-foreground" />
            <input
              {...inputProps(search)}
              placeholder="Busca RTX 4070, 7800X3D…"
              className="h-full min-w-0 flex-1 rounded-full bg-transparent pr-2 pl-11 [&::-webkit-search-cancel-button]:hidden text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
            />

            {/* Los segmentos y la X ocupan el mismo lugar: se cruzan con opacidad y escala, sin cambiar anchos. */}
            <div className="relative flex h-full shrink-0 items-center">
              <div
                className={cn(
                  "flex h-full items-center gap-1 transition-[opacity,transform] duration-base ease-in-out",
                  search.open ? "pointer-events-none scale-90 opacity-0" : "opacity-100",
                )}
              >
                <button
                  type="button"
                  onClick={() => search.focus()}
                  className="inline-flex h-full items-center gap-1.5 rounded-full bg-secondary px-3.5 font-medium text-foreground text-sm transition-colors hover:bg-secondary/70"
                >
                  <IconCategory className="size-4" />
                  <span className="hidden sm:inline">Categorías</span>
                </button>
                <QuoteAction className="h-full" />
              </div>
              <button
                type="button"
                aria-label="Cerrar búsqueda"
                onMouseDown={(e) => {
                  e.preventDefault();
                  search.setValue("");
                  search.setOpen(false);
                  search.blur();
                }}
                className={cn(
                  "absolute right-0 grid size-11 place-items-center rounded-full bg-secondary text-foreground transition-[opacity,transform] duration-base ease-in-out",
                  search.open ? "opacity-100" : "pointer-events-none scale-75 opacity-0",
                )}
              >
                <IconX className="size-5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
