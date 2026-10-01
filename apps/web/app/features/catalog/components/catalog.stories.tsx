import type { Meta, StoryObj } from "@storybook/react-vite";
import { categoryKeys } from "~/shared/lib/query-keys";
import { brands, categories, rowProducts } from "~/shared/storybook/fixtures";
import { withQueryData } from "~/shared/storybook/with-query-data";
import type { CatalogData } from "../load-catalog";
import { CategoryHeader, ExploreHeader } from "./catalog-headers";
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

export const CabeceraDeExplorar: Story = {
  name: "Cabecera de explorar",
  render: () => <ExploreHeader total={8} search={null} categories={categories} />,
};

export const CabeceraDeExplorarConBusqueda: Story = {
  name: "Cabecera de explorar con búsqueda",
  parameters: { path: "/explorar?search=rtx+5060" },
  render: () => <ExploreHeader total={2} search="rtx 5060" categories={categories} />,
};

export const BarraDeFiltros: Story = {
  name: "Barra de filtros",
  render: () => <FilterBar brands={brands} priceRange={{ min: 279_990, max: 939_990 }} total={8} />,
};

export const BarraDeFiltrosActivos: Story = {
  name: "Barra de filtros con filtros activos",
  // Los filtros viven en la URL: la historia abre una con marca, rango, stock y orden.
  parameters: {
    path: "/categoria/tarjetas-de-video?brand=msi&min_price=300000&max_price=500000&in_stock=1&sort=price_desc",
  },
  render: () => <FilterBar brands={brands} priceRange={{ min: 279_990, max: 939_990 }} total={3} />,
};

const catalog = (overrides: Partial<CatalogData> = {}): CatalogData => ({
  products: rowProducts,
  meta: { page: 2, limit: 24, total: 180, totalPages: 8 },
  brands,
  priceRange: { min: 279_990, max: 939_990 },
  trendingIds: [rowProducts[0].id ?? ""],
  rateLimited: false,
  category: "tarjetas-de-video",
  search: null,
  brand: null,
  inStock: false,
  ...overrides,
});

const withCategories = withQueryData([[categoryKeys.all, categories]]);

export const VistaDeCategoria: Story = {
  name: "Vista completa: categoría",
  decorators: [withCategories],
  render: () => <CatalogView data={catalog()} />,
};

export const VistaDeExplorar: Story = {
  name: "Vista completa: explorar",
  decorators: [withCategories],
  render: () => <CatalogView data={catalog({ category: null, brands: [], priceRange: null })} />,
};

export const VistaSinResultados: Story = {
  name: "Vista completa: sin resultados",
  decorators: [withCategories],
  parameters: { path: "/explorar?search=rtx+9090" },
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
  decorators: [withCategories],
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
