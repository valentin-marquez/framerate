import { IconTrash } from "@tabler/icons-react";
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { Button } from "~/shared/components/primitives/button";
import { cn } from "~/shared/lib/utils";

const HOLD_MS = 700;

/** `row` barre la fila del componente y `alt` la de una alternativa guardada (que vive dentro de la primera). */
type Scope = "row" | "alt";

/**
 * Quitar exige mantener pulsado: la papelera avisa con un velo que barre la fila (HoldSweep). Soltar, salir o perder
 * el foco antes de tiempo lo cancela. Un clic sin puntero (lector de pantalla) quita de inmediato.
 */
export function HoldToRemove({
  onRemove,
  label,
  scope = "row",
}: {
  onRemove: () => void;
  label: string;
  scope?: Scope;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stop = () => {
    clearTimeout(timer.current);
    setHolding(false);
  };
  const start = () => {
    if (holding) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      setHolding(false);
      onRemove();
    }, HOLD_MS);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const isHoldKey = (e: KeyboardEvent) => e.key === "Enter" || e.key === " ";
  const attrs = { [`data-hold-${scope}`]: "", ...(holding && { "data-holding": "" }) };

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={`${label}: mantén pulsado`}
      title="Mantén pulsado para quitar"
      className="touch-manipulation text-muted-foreground hover:text-destructive data-[holding]:text-destructive"
      {...attrs}
      onPointerDown={(e: PointerEvent) => e.button === 0 && start()}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (!isHoldKey(e)) return;
        e.preventDefault();
        if (!e.repeat) start();
      }}
      onKeyUp={(e) => {
        if (!isHoldKey(e)) return;
        e.preventDefault();
        stop();
      }}
      onBlur={stop}
      onClick={(e) => {
        e.preventDefault();
        if (e.detail === 0) onRemove();
      }}
    >
      <IconTrash />
    </Button>
  );
}

/** El velo rojo de la fila que contiene el `HoldToRemove` del mismo `scope`; la fila lleva `group/hold-<scope>`. */
export function HoldSweep({ scope = "row" }: { scope?: Scope }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 origin-left scale-x-0 bg-destructive/15 transition-[scale] duration-fast ease-out",
        scope === "row"
          ? "group-has-[[data-hold-row][data-holding]]/hold-row:scale-x-100 group-has-[[data-hold-row][data-holding]]/hold-row:duration-[700ms] group-has-[[data-hold-row][data-holding]]/hold-row:ease-linear"
          : "group-has-[[data-hold-alt][data-holding]]/hold-alt:scale-x-100 group-has-[[data-hold-alt][data-holding]]/hold-alt:duration-[700ms] group-has-[[data-hold-alt][data-holding]]/hold-alt:ease-linear",
      )}
    />
  );
}
