import type { Meta, StoryObj } from "@storybook/react-vite";
import { categories, rowProducts, stores } from "~/shared/storybook/fixtures";
import { CategoryLinks } from "./category-links";
import { CompactSearchHero } from "./compact-search-hero";
import { CategoryMosaic, StoresStrip } from "./home-blocks";
import { ProductRow } from "./product-row";

const meta = { title: "Home/Bloques" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Portada: Story = {
  name: "Portada con buscador",
  // El paso del buscador al navbar al bajar se ve en Layout/Navegación > Estructura del sitio.
  render: () => <CompactSearchHero categories={categories} />,
};

export const FilaDeProductos: Story = {
  name: "Fila de productos",
  render: () => (
    <ProductRow
      title="Tarjetas de video"
      href="/categoria/tarjetas-de-video"
      products={rowProducts}
      trendingIds={new Set([rowProducts[0].id])}
    />
  ),
};

export const MosaicoDeCategorias: Story = {
  name: "Mosaico de categorías",
  render: () => <CategoryMosaic categories={categories} />,
};

export const Tiendas: Story = { render: () => <StoresStrip stores={stores} /> };

export const EnlacesDeCategoria: Story = {
  name: "Enlaces de categoría",
  render: () => <CategoryLinks categories={categories} />,
};
