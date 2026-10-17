import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProductGrid } from "~/features/explore/components";
import { Navbar } from "~/shared/components/layout/navbar";
import { brands, catalogData, categories, freshness, gpuFacets, specMatchProducts } from "~/shared/storybook/fixtures";
import { categoryFacets } from "../load-catalog";
import { ActiveChips } from "./active-chips";
import { CategoryHeader, SearchHeader } from "./catalog-headers";
import { CatalogToolbar } from "./catalog-toolbar";
import { CatalogView } from "./catalog-view";
import { CategoryPanel } from "./category-panel";
import { FilterPanel } from "./filter-panel";

const meta = { title: "Catálogo/Cabeceras y filtros", id: "catalogo" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const CabeceraDeCategoria: Story = {
  name: "Cabecera de categoría",
  render: () => (
    <CategoryHeader category="tarjetas-de-video" total={8} priceRange={{ min: 279_990, max: 939_990 }} brandCount={3} />
  ),
};

export const CabeceraDeCategoriaLarga: Story = {
  name: "Cabecera de categoría con nombre largo",
  render: () => (
    <CategoryHeader category="ssd" total={162} priceRange={{ min: 23_900, max: 4_513_087 }} brandCount={33} />
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

/** El panel de filtros tal como va en el riel: el precio es un slider y el resto, campos que abren su lista. */
export const PanelDeFiltros: Story = {
  name: "Panel de filtros",
  render: () => (
    <div className="w-60">
      <FilterPanel data={catalogData()} />
    </div>
  ),
};

export const PanelConFiltrosActivos: Story = {
  name: "Panel con filtros activos",
  parameters: { path: "/categoria/tarjetas-de-video?brand=msi&brand=zotac&spec=vram:12&spec=vram:16&min_price=300000" },
  render: () => (
    <div className="w-60">
      <FilterPanel data={catalogData()} />
    </div>
  ),
};

export const PanelDeCategoria: Story = {
  name: "Panel de la categoría junto al riel (título, buscador, filtros y limpiar)",
  parameters: { path: "/categoria/tarjetas-de-video?spec=vram:8&brand=msi" },
  render: () => (
    <div className="flex h-[34rem] w-64 flex-col gap-3 border border-border/60 bg-card/40 p-3">
      <CategoryPanel data={catalogData()} />
    </div>
  ),
};

export const PanelEnHoja: Story = {
  name: "Panel en la hoja de teléfono (campos que se despliegan)",
  render: () => (
    <div className="w-80">
      <FilterPanel data={catalogData()} inline />
    </div>
  ),
};

export const BarraDeOrdenYPaginas: Story = {
  name: "Barra de orden, por página y flechas",
  parameters: { path: "/categoria/tarjetas-de-video?sort=price_desc&limit=12" },
  render: () => (
    <CatalogToolbar
      total={180}
      page={2}
      totalPages={15}
      pageSize={12}
      defaultSort="price_asc"
      onPageChange={() => {}}
    />
  ),
};

export const ChipsDeFiltros: Story = {
  name: "Filtros aplicados",
  parameters: {
    path: "/categoria/tarjetas-de-video?brand=msi&brand=zotac&spec=vram:16&min_price=300000&max_price=500000",
  },
  render: () => <ActiveChips brands={brands} definitions={categoryFacets("tarjetas-de-video")} />,
};

export const SeparadorDeDesconocidos: Story = {
  name: "Grilla con desconocidos al final",
  render: () => <ProductGrid products={specMatchProducts} missingSpec="memoria" />,
};

export const SoloDesconocidos: Story = {
  name: "Grilla con todos desconocidos",
  render: () => (
    <ProductGrid
      products={specMatchProducts.map((p) => ({ ...p, specMatch: "unknown" }))}
      missingSpec="memoria o modelo"
    />
  ),
};

const catalog = catalogData;

export const VistaConFacetas: Story = {
  name: "Vista completa: filtrada por especificación",
  parameters: { path: "/categoria/tarjetas-de-video?spec=vram:8" },
  render: () => (
    <CatalogView
      data={catalog({
        products: specMatchProducts,
        meta: { page: 1, limit: 24, total: 5, totalPages: 1 },
        facets: gpuFacets,
        spec: ["vram:8"],
      })}
    />
  ),
};

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

/** El armado de `root.tsx` en la categoría, con el anuncio a la derecha de la cabecera. */
export const PaginaConAnuncio: Story = {
  name: "Página de categoría con anuncio",
  parameters: { layout: "fullscreen", path: "/categoria/tarjetas-de-video", catalog: catalog() },
  render: () => {
    const data = catalog();
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar categories={categories} freshness={freshness} initialCollapsed={false} />
        <div className="flex flex-1 flex-col lg:pl-64">
          <main className="container mx-auto flex-1 px-4 pt-6 lg:pt-11">
            <CatalogView data={data} />
          </main>
        </div>
      </div>
    );
  },
};
