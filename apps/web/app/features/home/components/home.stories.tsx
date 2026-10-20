import type { Meta, StoryObj } from "@storybook/react-vite";
import { dropProducts, homeStores, publicQuotes, rowProducts } from "~/shared/storybook/fixtures";
import { StoresStrip } from "./home-blocks";
import { HomeIntro } from "./home-intro";
import { ProductRow } from "./product-row";
import { PublicQuotes } from "./public-quotes";

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
  render: () => (
    <ProductRow title="Bajadas de precio" href="/buscar?sort=discount" more="Ver todas" products={dropProducts} />
  ),
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

/**
 * De más a menos "me gusta": la primera en grande, con su collage, descripción y total, y las siguientes en una lista.
 * Se eligió entre tres composiciones (A filas, B carrusel, C destacada y lista) el 19-10-2026. Con menos de tres
 * cotizaciones no se muestra.
 */
export const CotizacionesPopulares: Story = {
  name: "Cotizaciones populares",
  render: () => <PublicQuotes quotes={publicQuotes} />,
};

/** Con tres o cuatro públicas, las últimas celdas se ensanchan para no dejar huecos. */
export const CotizacionesPocas: Story = {
  name: "Cotizaciones populares (tres y cuatro)",
  render: () => (
    <div className="space-y-10">
      <PublicQuotes quotes={publicQuotes.slice(0, 3)} />
      <PublicQuotes quotes={publicQuotes.slice(0, 4)} />
    </div>
  ),
};

export const CotizacionesSinFotos: Story = {
  name: "Cotizaciones populares sin fotos",
  render: () => (
    <PublicQuotes
      quotes={publicQuotes.map((q, i) => ({
        ...q,
        images: [],
        name: i === 0 ? "Armado para jugar en 1440p y editar video los fines de semana con mucho espacio" : q.name,
      }))}
    />
  ),
};
