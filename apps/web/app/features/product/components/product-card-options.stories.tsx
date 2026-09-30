import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentType } from "react";
import { cardCases } from "~/shared/storybook/fixtures";
import {
  ProductCardCompare,
  ProductCardGallery,
  type ProductCardOptionProps,
  ProductCardRow,
} from "./product-card-options";

const meta = {
  title: "Producto/Tarjeta unificada",
  id: "tarjeta-unificada",
  parameters: { layout: "padded" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Cada versión en los tres contextos donde vive: grilla del catálogo, carrusel de la home y móvil. */
function Showcase({ Card, rowLayout }: { Card: ComponentType<ProductCardOptionProps>; rowLayout?: boolean }) {
  return (
    <div className="space-y-12">
      <section className="space-y-3">
        <h2 className="font-medium text-muted-foreground text-sm">Catálogo · 1440 px</h2>
        <div className={rowLayout ? "grid gap-3 lg:grid-cols-2 xl:grid-cols-3" : "grid grid-cols-4 gap-5"}>
          {cardCases.map((c, i) => (
            <div key={c.label} className="space-y-2">
              <Card product={c.product} trending={c.trending} priority={i < 4} />
              <p className="text-center text-[11px] text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium text-muted-foreground text-sm">Carrusel de la home</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {cardCases.slice(0, 5).map((c) => (
            <div key={c.label} className={rowLayout ? "w-[340px] shrink-0" : "w-[210px] shrink-0"}>
              <Card product={c.product} trending={c.trending} />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium text-muted-foreground text-sm">Móvil · 390 px</h2>
        <div className="w-[390px] rounded-3xl border border-border bg-background p-4">
          <div className={rowLayout ? "grid gap-3" : "grid grid-cols-2 gap-3"}>
            {cardCases.slice(0, 4).map((c) => (
              <Card key={c.label} product={c.product} trending={c.trending} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export const V1Galeria: Story = {
  name: "v1 · Galería",
  render: () => <Showcase Card={ProductCardGallery} />,
};

export const V2Comparador: Story = {
  name: "v2 · Comparador",
  render: () => <Showcase Card={ProductCardCompare} />,
};

export const V3Fila: Story = {
  name: "v3 · Fila",
  render: () => <Showcase Card={ProductCardRow} rowLayout />,
};
