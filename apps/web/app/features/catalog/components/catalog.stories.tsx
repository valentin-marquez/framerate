import type { Meta, StoryObj } from "@storybook/react-vite";
import { brands, categories } from "~/shared/storybook/fixtures";
import { CategoryHeader, ExploreHeader } from "./catalog-headers";
import { FilterBar } from "./filter-bar";

const meta = { title: "Catálogo/Cabeceras y filtros", id: "catalogo" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const CabeceraDeCategoria: Story = {
  name: "Cabecera de categoría",
  render: () => (
    <CategoryHeader category="tarjetas-de-video" total={8} priceRange={{ min: 279_990, max: 939_990 }} brandCount={3} />
  ),
};

export const CabeceraDeExplorar: Story = {
  name: "Cabecera de explorar",
  render: () => <ExploreHeader total={8} search={null} categories={categories} />,
};

export const BarraDeFiltros: Story = {
  name: "Barra de filtros",
  render: () => <FilterBar brands={brands} priceRange={{ min: 279_990, max: 939_990 }} total={8} />,
};
