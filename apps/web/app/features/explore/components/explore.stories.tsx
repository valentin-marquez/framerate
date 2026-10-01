import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { rowProducts } from "~/shared/storybook/fixtures";
import { Pagination, ProductGrid } from "./product-grid";
import { ProductGridSkeleton } from "./product-grid-skeleton";

const meta = { title: "Catálogo/Grilla y paginación" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Grilla: Story = {
  render: () => <ProductGrid products={rowProducts} trendingIds={new Set([rowProducts[1].id ?? ""])} />,
};

export const GrillaCargando: Story = {
  name: "Grilla cargando",
  render: () => <ProductGridSkeleton count={6} />,
};

export const GrillaVacia: Story = {
  name: "Grilla sin resultados",
  render: () => <ProductGrid products={[]} />,
};

function ControlledPagination({ initial, total }: { initial: number; total: number }) {
  const [page, setPage] = useState(initial);
  return <Pagination currentPage={page} totalPages={total} onPageChange={setPage} />;
}

export const Paginacion: Story = {
  name: "Paginación",
  render: () => (
    <div className="space-y-6">
      <ControlledPagination initial={1} total={3} />
      <ControlledPagination initial={6} total={12} />
      <ControlledPagination initial={12} total={12} />
    </div>
  ),
};
