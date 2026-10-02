import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "~/shared/components/primitives/button";
import { cn } from "~/shared/lib/utils";

/** El lenguaje de motion (`apps/web/CLAUDE.md`): dos curvas y tres duraciones, tokens de `app.css`. */
const meta = { title: "Fundamentos/Movimiento" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const COMBOS = [
  ["ease-out duration-fast", "Hover, foco y color. Entrada de algo chico (menú, popover). Salidas."],
  ["ease-out duration-base", "Entrada de algo grande: diálogo, panel, aviso, paso de un asistente."],
  [
    "ease-in-out duration-base",
    "Elemento que se transforma o se mueve en pantalla: el buscador que se acopla al navbar.",
  ],
  ["ease-out duration-slow", "Cambio de página y cascada de la carga inicial."],
] as const;

function MotionDemo() {
  const [on, setOn] = useState(false);
  const [run, setRun] = useState(0);
  return (
    <div className="max-w-2xl space-y-8">
      <Button
        variant="secondary"
        onClick={() => {
          setOn(!on);
          setRun(run + 1);
        }}
      >
        Reproducir
      </Button>

      <div className="space-y-5">
        {COMBOS.map(([className, use]) => (
          <div key={className} className="space-y-2">
            <div>
              <code className="font-mono text-foreground text-xs">{className}</code>
              <p className="text-muted-foreground text-sm">{use}</p>
            </div>
            <div className="rounded-full bg-secondary p-1">
              <div className={cn("transition-transform", className, on && "translate-x-[calc(100%-1.5rem)]")}>
                <div className="size-6 rounded-full bg-primary" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div>
          <code className="font-mono text-foreground text-xs">.enter-up</code>
          <p className="text-muted-foreground text-sm">Cascada de la carga inicial: escalonado de 50 ms, hasta ~6.</p>
        </div>
        <div key={run} className="grid grid-cols-6 gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="enter-up h-16 rounded-xl border border-border bg-card"
              style={{ "--delay": `${i * 50}ms` } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export const Movimiento: Story = { render: () => <MotionDemo /> };
