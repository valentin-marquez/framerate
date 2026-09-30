import type { Meta, StoryObj } from "@storybook/react-vite";
import { cardCases } from "~/shared/storybook/fixtures";
import { ProductCard, ProductCardSkeleton } from "./product-card";

const meta = { title: "Producto/Tarjeta", id: "tarjeta", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Casos: Story = {
  render: () => (
    <div className="grid gap-x-3 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
      {cardCases.map((c, i) => (
        <div key={c.label} className="space-y-2">
          <ProductCard product={c.product} trending={c.trending} priority={i < 3} />
          <p className="text-center text-[11px] text-muted-foreground">{c.label}</p>
        </div>
      ))}
    </div>
  ),
};

export const Carrusel: Story = {
  render: () => (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {cardCases.slice(0, 5).map((c) => (
        <div key={c.label} className="w-[340px] shrink-0">
          <ProductCard product={c.product} trending={c.trending} />
        </div>
      ))}
    </div>
  ),
};

export const Movil: Story = {
  name: "Móvil",
  render: () => (
    <div className="grid w-[390px] gap-3 rounded-3xl border border-border bg-background p-4">
      {cardCases.slice(0, 4).map((c) => (
        <ProductCard key={c.label} product={c.product} trending={c.trending} />
      ))}
    </div>
  ),
};

export const Cargando: Story = {
  render: () => (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <ProductCardSkeleton />
      <ProductCardSkeleton />
      <ProductCardSkeleton />
    </div>
  ),
};
