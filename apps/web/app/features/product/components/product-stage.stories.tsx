import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { cardCases } from "~/shared/storybook/fixtures";
import { ProductCard } from "./product-card";

const meta = { title: "Producto/Carga de la foto", id: "carga-foto", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Distinto en cada carga de Storybook, para que la primera vista tampoco salga de caché. */
const NONCE = Date.now();

const SPEEDS = [
  { label: "Normal", value: 1 },
  { label: "Lento ×3", value: 3 },
  { label: "Muy lento ×8", value: 8 },
];

/** Repite la carga de la foto (con una URL nueva para que no salga de caché) y permite verla en cámara lenta. */
function Replay() {
  const [run, setRun] = useState(0);
  const [slowmo, setSlowmo] = useState(1);
  const cases = cardCases.filter((c) => c.product.image_url).slice(0, 3);

  return (
    <div className="space-y-5" style={{ "--stage-slowmo": slowmo } as React.CSSProperties}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setRun((r) => r + 1)}
          className="rounded-full bg-primary px-4 py-1.5 font-medium text-primary-foreground text-sm"
        >
          Repetir
        </button>
        {SPEEDS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setSlowmo(s.value)}
            className={`rounded-full px-3 py-1.5 text-sm ${slowmo === s.value ? "bg-secondary font-medium text-foreground" : "text-muted-foreground"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div key={run} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cases.map((c) => (
          <ProductCard
            key={c.label}
            product={{ ...c.product, image_url: `${c.product.image_url}?r=${NONCE}-${run}` }}
          />
        ))}
      </div>
    </div>
  );
}

export const Repetir: Story = { render: () => <Replay /> };
