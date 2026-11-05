import { MmRangeParamSchema, mmRangeParam } from "@framerate/contracts";
import { useFilterParams } from "~/features/catalog/use-filter-params";
import { Button } from "~/shared/components/primitives/button";

const WIDEN_MM = 5;

/** Bajo los filtros, con el rango activo. Si no alcanza ningún mouse, ofrece ampliarlo. */
export function MouseFitNotice({ total }: { total: number }) {
  const { params, update } = useFilterParams();
  const length = MmRangeParamSchema.safeParse(params.get("fit_length"));
  const width = MmRangeParamSchema.safeParse(params.get("fit_width"));
  if (!length.success && !width.success) return null;
  const widen = (range: typeof length) =>
    range.success ? mmRangeParam({ min: range.data.min - WIDEN_MM, max: range.data.max + WIDEN_MM }) : null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
      <p>Sólo se muestran mouses con medidas conocidas. Es una orientación: cada mano es distinta.</p>
      {total === 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => update({ fit_length: widen(length), fit_width: widen(width) })}
        >
          Ampliar el rango
        </Button>
      )}
    </div>
  );
}
