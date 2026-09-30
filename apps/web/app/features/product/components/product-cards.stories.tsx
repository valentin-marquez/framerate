import type { Meta, StoryObj } from "@storybook/react-vite";
import { products } from "~/shared/storybook/fixtures";
import { ProductCard } from "./card-product";
import { ProductCardCompact } from "./card-product-compact";

const meta = { title: "Producto/Tarjetas" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Catalogo: Story = {
  name: "Tarjeta de catálogo",
  render: () => (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} trending={i === 0} />
      ))}
    </div>
  ),
};

export const Compacta: Story = {
  name: "Tarjeta compacta (home)",
  render: () => (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {products.map((product, i) => (
        <ProductCardCompact key={product.id} product={product} trending={i === 1} />
      ))}
    </div>
  ),
};
