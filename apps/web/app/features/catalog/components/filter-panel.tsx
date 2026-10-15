import { facetValueLabel } from "@framerate/contracts";
import { type CatalogData, categoryFacets } from "../load-catalog";
import { specValue, useFilterParams } from "../use-filter-params";
import { type FieldOption, FilterField, PriceSlider } from "./filter-fields";

/** Lo marcado siempre se ve, aunque ya no tenga productos con los otros filtros: queda en 0 y se puede quitar. */
function withSelected(options: FieldOption[], selected: string[], labelOf: (value: string) => string = (v) => v) {
  const missing = selected.filter((v) => !options.some((o) => o.value === v));
  return [...options, ...missing.map((value) => ({ value, label: labelOf(value), count: 0 }))];
}

const number = (value: string | null) => (value && Number.isFinite(Number(value)) ? Number(value) : null);

/** Cantidad de filtros aplicados (el texto de búsqueda no cuenta: no es del panel). */
export function activeFilterCount(params: URLSearchParams) {
  return (
    params.getAll("brand").length +
    params.getAll("spec").length +
    (params.get("min_price") || params.get("max_price") ? 1 : 0)
  );
}

/**
 * Cuerpo de filtros de una categoría: el precio es un slider y el resto, campos que se abren con selección múltiple.
 * Lo comparten el riel (escritorio) y la hoja (teléfono, `inline`).
 */
export function FilterPanel({
  data,
  inline,
}: {
  data: Pick<CatalogData, "brands" | "facets" | "priceRange" | "category">;
  inline?: boolean;
}) {
  const { params, update } = useFilterParams();
  const brandSel = params.getAll("brand");
  const specs = params.getAll("spec");
  const definitions = categoryFacets(data.category);
  const range = data.priceRange;
  const bounds =
    range?.min != null && range.max != null && range.min < range.max ? { min: range.min, max: range.max } : null;

  return (
    <div className="flex flex-col gap-2">
      {bounds && (
        <PriceSlider
          bounds={bounds}
          min={number(params.get("min_price"))}
          max={number(params.get("max_price"))}
          onCommit={(min, max) =>
            update({ min_price: min === null ? null : String(min), max_price: max === null ? null : String(max) })
          }
        />
      )}
      {data.category && (
        <FilterField
          inline={inline}
          label="Marca"
          options={withSelected(
            data.brands.map((b) => ({ value: b.slug, label: b.name, count: b.count })),
            brandSel,
          )}
          selected={brandSel}
          onToggle={(slug) =>
            update({ brand: brandSel.includes(slug) ? brandSel.filter((s) => s !== slug) : [...brandSel, slug] })
          }
          onClear={() => update({ brand: null })}
        />
      )}
      {definitions.map((def) => {
        // Sin productos con los otros filtros la API no devuelve la faceta: el campo se queda, vacío, y no salta el panel.
        const f = data.facets.find((x) => x.key === def.key) ?? {
          key: def.key,
          label: def.label,
          values: [],
          unknownCount: 0,
        };
        const selected = specs.map((t) => specValue(t, f.key)).filter((v) => v !== null);
        return (
          <FilterField
            key={f.key}
            inline={inline}
            label={f.label}
            options={withSelected(f.values, selected, (v) => facetValueLabel(def, v))}
            selected={selected}
            note={
              f.unknownCount > 0
                ? `${f.unknownCount.toLocaleString("es-CL")} sin este dato ${f.unknownCount === 1 ? "aparece" : "aparecen"} al final`
                : undefined
            }
            onToggle={(value) => {
              const token = `${f.key}:${value}`;
              update({ spec: specs.includes(token) ? specs.filter((t) => t !== token) : [...specs, token] });
            }}
            onClear={() => update({ spec: specs.filter((t) => specValue(t, f.key) === null) })}
          />
        );
      })}
    </div>
  );
}
