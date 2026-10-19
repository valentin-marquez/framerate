import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconUserCircle } from "@tabler/icons-react";
import { HomeContent } from "~/features/home/components/home-content";
import type { MyStore } from "~/features/profile/services/profiles";
import { SearchField } from "~/features/search/components/search-field";
import { MyStoresMenu } from "~/features/stores/components/my-stores-menu";
import {
  catalogData,
  categories,
  dropProducts,
  freshness,
  publicQuotes,
  rowProducts,
  sessions,
  stores,
} from "~/shared/storybook/fixtures";
import { withQueryData } from "~/shared/storybook/with-query-data";
import { Button } from "../primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu";
import { AdminMenu } from "./admin-menu";
import { Navbar } from "./navbar";
import { SiteFooter } from "./site-footer";

const meta = { title: "Layout/Navegación", id: "layout", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const myStores: { stores: MyStore[] } = {
  stores: [
    { id: "tectec", slug: "tectec", name: "TecTec", icon_url: null, role: "owner" },
    { id: "dust2", slug: "dust2", name: "Dust2", icon_url: null, role: "editor" },
  ],
};
// Misma clave que usa `MyStoresMenu` (la API todavía no tiene "mis tiendas": el servicio devuelve una lista vacía).
const withMyStores = withQueryData([[["profile", "me", "stores"], myStores]]);

export const NavbarVisitante: Story = {
  name: "Navbar: visitante",
  render: () => (
    <div className="h-screen">
      <Navbar categories={categories} freshness={freshness} initialCollapsed={false} />
    </div>
  ),
};

export const NavbarConSesion: Story = {
  name: "Navbar: con sesión",
  // La sesión llega por los datos del loader raíz (ver `.storybook/preview.tsx`).
  parameters: { session: sessions.user, path: "/buscar" },
  render: () => (
    <div className="h-screen">
      <Navbar categories={categories} freshness={freshness} initialCollapsed={false} />
    </div>
  ),
};

export const NavbarCategoria: Story = {
  name: "Navbar: en una categoría (riel compacto y panel de filtros a su derecha; F lo pliega)",
  // `catalog` simula los datos del loader de la categoría, de donde el riel saca sus filtros.
  parameters: { path: "/categoria/tarjetas-de-video?brand=msi&spec=vram:8", catalog: catalogData() },
  render: () => (
    <div className="h-screen">
      <Navbar categories={categories} freshness={freshness} initialCollapsed={false} />
    </div>
  ),
};

export const NavbarPlegado: Story = {
  name: "Navbar: riel plegado",
  parameters: { session: sessions.user, path: "/categoria/tarjetas-de-video" },
  render: () => (
    <div className="h-screen">
      <Navbar categories={categories} freshness={freshness} initialCollapsed />
    </div>
  ),
};

export const NavbarAdminConMenu: Story = {
  name: "Navbar: admin con el menú abierto",
  parameters: { session: sessions.admin, path: "/categoria/tarjetas-de-video" },
  decorators: [withMyStores],
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "Usuario" }));
  },
  render: () => (
    <div className="h-screen">
      <Navbar categories={categories} freshness={freshness} initialCollapsed={false} />
    </div>
  ),
};

export const NavbarMovil: Story = {
  name: "Navbar: móvil",
  globals: { viewport: { value: "mobile1", isRotated: false } },
  parameters: { session: sessions.user },
  render: () => (
    <div className="h-screen">
      <Navbar categories={categories} freshness={freshness} initialCollapsed={false} />
    </div>
  ),
};

export const MenuDeCuenta: Story = {
  name: "Secciones del menú de cuenta",
  parameters: { session: sessions.admin, layout: "padded" },
  decorators: [withMyStores],
  render: () => (
    <div className="h-[28rem]">
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Usuario" />}>
          <IconUserCircle className="size-6" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-69">
          {/* Como en el navbar: las secciones traen su etiqueta y van dentro de un grupo. */}
          <DropdownMenuGroup>
            <DropdownMenuItem>Perfil</DropdownMenuItem>
            <MyStoresMenu enabled />
            <AdminMenu enabled />
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
};

export const BuscadorConConsulta: Story = {
  name: "Buscador con consulta",
  // En `/buscar` el campo muestra la consulta de la URL.
  parameters: { layout: "padded", path: "/buscar?q=rtx+5060" },
  render: () => <SearchField className="w-72" />,
};

export const Pie: Story = { render: () => <SiteFooter /> };

/**
 * El armado de `root.tsx` con el home: riel fijo con el buscador y las categorías, contenido desplazado y pie.
 */
export const EstructuraDelSitio: Story = {
  name: "Estructura del sitio (home)",
  render: () => (
    <div className="flex min-h-screen flex-col pb-16">
      <Navbar categories={categories} freshness={freshness} initialCollapsed={false} />
      <div className="flex flex-1 flex-col lg:pl-64">
        <main className="container mx-auto flex-1 px-4 pt-6 lg:pt-11">
          <HomeContent
            categories={categories}
            stores={stores}
            trendingIds={[rowProducts[2].id]}
            drops={dropProducts}
            quotes={publicQuotes}
            rows={[
              { key: "popular", title: "Lo más popular", href: "/buscar", products: rowProducts },
              {
                key: "gpu",
                title: "Tarjetas de video",
                href: "/categoria/tarjetas-de-video",
                products: rowProducts.slice(2),
              },
            ]}
          />
        </main>
        <SiteFooter />
      </div>
    </div>
  ),
};
