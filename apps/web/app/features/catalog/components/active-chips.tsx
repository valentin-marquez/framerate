import { type BrandCount, type FacetDefinition, facetOptionLabel } from "@framerate/contracts";
import { IconX } from "@tabler/icons-react";
import { useState } from "react";
import { formatCLP } from "~/shared/utils/format";
import { specValue, useFilterParams } from "../use-filter-params";

/** Filtros aplicados, cada uno con su quitar. Sólo aparece cuando hay alguno. */
export function ActiveChips({ brands, definitions }: { brands: BrandCount[]; definitions: FacetDefinition[] }) {
  const { params, update } = useFilterParams();
  // Chips recién quitados: el filtro ya se aplicó (al instante); sólo quedan para animar su salida.
  const [ghosts, setGhosts] = useState<{ label: string; index: number; delay: number }[]>([]);
  const chips: { label: string; clear: Record<string, string[] | null> }[] = [];
  const selectedBrands = params.getAll("brand");
  for (const slug of selectedBrands) {
    chips.push({
      label: brands.find((b) => b.slug === slug)?.name ?? slug,
      clear: { brand: selectedBrands.filter((s) => s !== slug) },
    });
  }
  const min = params.get("min_price");
  const max = params.get("max_price");
  if (min || max) {
    const label =
      min && max
        ? `${formatCLP(Number(min))} a ${formatCLP(Number(max))}`
        : min
          ? `Desde ${formatCLP(Number(min))}`
          : `Hasta ${formatCLP(Number(max))}`;
    chips.push({ label, clear: { min_price: null, max_price: null } });
  }
  const specs = params.getAll("spec");
  for (const token of specs) {
    const facet = definitions.find((f) => specValue(token, f.key) !== null);
    if (!facet) continue;
    const label = `${facet.label}: ${facetOptionLabel(facet, specValue(token, facet.key) ?? "")}`;
    chips.push({ label, clear: { spec: specs.filter((t) => t !== token) } });
  }
  if (params.get("q")) chips.push({ label: `“${params.get("q")}”`, clear: { q: null } });

  const remove = (labels: string[], change: Parameters<typeof update>[0]) => {
    setGhosts(
      labels.map((label, i) => ({
        label,
        index: chips.findIndex((c) => c.label === label),
        delay: Math.min(i, 5) * 30,
      })),
    );
    update(change);
  };
  const clearAll = { brand: null, min_price: null, max_price: null, q: null, spec: null };

  // Los fantasmas vuelven a su posición anterior entre los chips que siguen activos.
  type Item =
    | { kind: "chip"; label: string; clear: Record<string, string[] | null> }
    | { kind: "ghost"; label: string; delay: number };
  const items: Item[] = chips.map((c) => ({ kind: "chip", ...c }));
  for (const g of [...ghosts].sort((a, b) => a.index - b.index)) {
    if (!chips.some((c) => c.label === g.label)) {
      items.splice(Math.min(g.index, items.length), 0, { kind: "ghost", label: g.label, delay: g.delay });
    }
  }
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) =>
        item.kind === "ghost" ? (
          <span
            key={`ghost-${item.label}`}
            aria-hidden="true"
            onAnimationEnd={() => setGhosts((gs) => gs.filter((g) => g.label !== item.label))}
            style={{ animationDelay: `${item.delay}ms` }}
            className="pointer-events-none inline-flex items-center gap-1 rounded-full bg-secondary/60 px-3 py-1 text-foreground text-xs fade-out-0 zoom-out-90 animate-out fill-mode-forwards duration-100"
          >
            {item.label}
            <IconX className="size-3 text-muted-foreground" />
          </span>
        ) : (
          <button
            key={item.label}
            type="button"
            onClick={() => remove([item.label], item.clear)}
            className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-3 py-1 text-foreground text-xs transition-colors hover:bg-secondary fade-in-0 zoom-in-90 animate-in duration-fast"
          >
            {item.label}
            <IconX className="size-3 text-muted-foreground" />
          </button>
        ),
      )}
      {chips.length > 0 && (
        <button
          type="button"
          onClick={() =>
            remove(
              chips.map((c) => c.label),
              clearAll,
            )
          }
          className="text-muted-foreground text-xs transition-colors hover:text-foreground"
        >
          Limpiar todo
        </button>
      )}
    </div>
  );
}
