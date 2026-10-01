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
  // El campo real es `MorphSearch` (flota sobre el ancla); aquí se ve sólo el espacio que reserva. El armado completo
  // está en Layout/Navegación > Estructura del sitio.
  render: () => (
    <div className="space-y-2">
      <CompactSearchHero categories={categories} />
      <p className="text-center text-muted-foreground text-xs">El hueco bajo el título es el ancla del buscador.</p>
    </div>
  ),
};

export const FilaDeProductos: Story = {
  name: "Fila de productos",
  render: () => (
    <ProductRow
      title="Tarjetas de video"
      href="/categoria/tarjetas-de-video"
      products={rowProducts}
      trendingIds={new Set([rowProducts[0].id ?? ""])}
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
