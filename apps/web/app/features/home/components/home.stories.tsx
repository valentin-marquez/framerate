import type { Meta, StoryObj } from "@storybook/react-vite";
import { dropProducts, homeStores, rowProducts } from "~/shared/storybook/fixtures";
import { StoresStrip } from "./home-blocks";
import { HomeIntro } from "./home-intro";
import { ProductRow } from "./product-row";

const meta = { title: "Home/Bloques" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Portada: Story = {
  name: "Encabezado con cifras",
  // El buscador vive en el navbar: se ve en Layout/Navegación > Estructura del sitio.
  render: () => <HomeIntro productCount={1240} storeCount={9} />,
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

export const BajasDePrecio: Story = {
  name: "Fila de bajas de precio",
  render: () => <ProductRow title="Ofertas" href="/buscar?sort=discount" more="Ver todas" products={dropProducts} />,
};

/**
 * En teléfono, dos filas que avanzan solas hacia la izquierda, sin fin: arriba las 12 tiendas con más ofertas, con
 * nombre y cifra, más lenta para que se alcance a leer; abajo el resto, sólo el ícono y más rápido. Se detienen al
 * tocarlas o con foco; con movimiento reducido quedan quietas y se recorren a mano. Sólo animan `transform`, así que no
 * ocupan el hilo principal. Se eligió entre cuatro composiciones (16-10-2026) por mostrar la cifra de cada tienda grande.
 */
export const TiendasTelefono: Story = {
  name: "Tiendas (teléfono)",
  globals: { viewport: { value: "mobile1", isRotated: false } },
  render: () => <StoresStrip stores={homeStores} />,
};

/** Desde tablet, la lista que envuelve, en el orden de la API. */
export const Tiendas: Story = {
  name: "Tiendas (escritorio)",
  render: () => <StoresStrip stores={homeStores} />,
};
