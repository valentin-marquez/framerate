import { Tabs } from "@cloudflare/kumo";
import type { ReactNode } from "react";

export type View = "data" | "structure";

// La barra única de arriba, como en Drizzle: vista a la izquierda, acciones al medio, estado a la derecha.
export function Toolbar({
  view,
  onView,
  children,
  end,
}: {
  view?: View;
  onView?: (v: View) => void;
  children?: ReactNode;
  end?: ReactNode;
}) {
  return (
    <div className="flex min-h-14 flex-wrap items-center gap-2 border-b border-kumo-line px-3 py-2">
      {view && onView && (
        <Tabs
          size="sm"
          value={view}
          onValueChange={(v) => onView(v as View)}
          tabs={[
            { value: "data", label: "Datos" },
            { value: "structure", label: "Estructura" },
          ]}
        />
      )}
      {children}
      <div className="ml-auto flex items-center gap-2">{end}</div>
    </div>
  );
}
