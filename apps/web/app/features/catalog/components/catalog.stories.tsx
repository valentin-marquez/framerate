import type { Meta, StoryObj } from "@storybook/react-vite";
import { brands, rowProducts } from "~/shared/storybook/fixtures";
import type { CatalogData } from "../load-catalog";
import { CategoryHeader, SearchHeader } from "./catalog-headers";
import { CatalogView } from "./catalog-view";
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

export const CabeceraDeCategoriaVacia: Story = {
  name: "Cabecera de categoría sin productos",
  render: () => <CategoryHeader category="procesadores" total={0} priceRange={null} brandCount={0} />,
};

export const CabeceraDeBusqueda: Story = {
  name: "Cabecera de búsqueda sin consulta",
  render: () => <SearchHeader total={8} search={null} />,
};

export const CabeceraDeBusquedaConConsulta: Story = {
  name: "Cabecera de búsqueda con consulta",
  parameters: { path: "/buscar?q=rtx+5060" },
  render: () => <SearchHeader total={2} search="rtx 5060" />,
};

export const BarraDeFiltros: Story = {
  name: "Barra de filtros",
  render: () => <FilterBar brands={brands} priceRange={{ min: 279_990, max: 939_990 }} total={8} />,
};

export const BarraDeFiltrosActivos: Story = {
  name: "Barra de filtros con filtros activos",
  // Los filtros viven en la URL: la historia abre una con marca, rango y orden.
  parameters: {
    path: "/categoria/tarjetas-de-video?brand=msi&min_price=300000&max_price=500000&sort=price_desc",
  },
  render: () => <FilterBar brands={brands} priceRange={{ min: 279_990, max: 939_990 }} total={3} />,
};

const catalog = (overrides: Partial<CatalogData> = {}): CatalogData => ({
  products: rowProducts,
  meta: { page: 2, limit: 24, total: 180, totalPages: 8 },
  brands,
  priceRange: { min: 279_990, max: 939_990 },
  trendingIds: [rowProducts[0].id],
  rateLimited: false,
  category: "tarjetas-de-video",
  search: null,
  brand: null,
  ...overrides,
});

export const VistaDeCategoria: Story = {
  name: "Vista completa: categoría",
  render: () => <CatalogView data={catalog()} />,
};

export const VistaDeBusqueda: Story = {
  name: "Vista completa: búsqueda",
  render: () => <CatalogView data={catalog({ category: null, brands: [], priceRange: null })} />,
};

export const VistaSinResultados: Story = {
  name: "Vista completa: sin resultados",
  parameters: { path: "/buscar?q=rtx+9090" },
  render: () => (
    <CatalogView
      data={catalog({
        products: [],
        meta: { page: 1, limit: 24, total: 0, totalPages: 0 },
        category: null,
        search: "rtx 9090",
        brands: [],
        priceRange: null,
      })}
    />
  ),
};

export const VistaSaturada: Story = {
  name: "Vista completa: API saturada (429)",
  render: () => (
    <CatalogView
      data={catalog({
        products: [],
        meta: { page: 1, limit: 24, total: 0, totalPages: 0 },
        rateLimited: true,
        brands: [],
        priceRange: null,
      })}
    />
  ),
};
