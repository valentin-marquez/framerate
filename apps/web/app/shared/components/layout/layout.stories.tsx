import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconCompass, IconCpu, IconUserCircle } from "@tabler/icons-react";
import { HomeContent } from "~/features/home/components/home-content";
import type { MyStore } from "~/features/profile/services/profiles";
import { MyStoresMenu } from "~/features/stores/components/my-stores-menu";
import { categories, rowProducts, sessions, stores } from "~/shared/storybook/fixtures";
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
import { MorphSearch } from "./morph-search";
import { NavClock, NavTab } from "./nav-parts";
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
    <div className="h-40">
      <Navbar categories={categories} />
    </div>
  ),
};

export const NavbarConSesion: Story = {
  name: "Navbar: con sesión",
  // La sesión llega por los datos del loader raíz (ver `.storybook/preview.tsx`).
  parameters: { session: sessions.user, path: "/explorar" },
  render: () => (
    <div className="h-40">
      <Navbar categories={categories} />
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
    <div className="h-[36rem]">
      <Navbar categories={categories} />
    </div>
  ),
};

export const NavbarMovil: Story = {
  name: "Navbar: móvil",
  globals: { viewport: { value: "mobile1", isRotated: false } },
  parameters: { session: sessions.user },
  render: () => (
    <div className="h-40">
      <Navbar categories={categories} />
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

export const Pestanas: Story = {
  name: "Pestañas y reloj",
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex items-center gap-6">
      <NavTab to="/explorar" icon={IconCompass} label="Explorar" active />
      <NavTab to="/categoria/tarjetas-de-video" icon={IconCpu} label="Hardware" active={false} />
      <NavTab to="/explorar" icon={IconCompass} label="Explorar" active={false} iconOnly />
      <NavClock />
    </div>
  ),
};

export const Pie: Story = { render: () => <SiteFooter /> };

/**
 * El armado de `root.tsx` con el home: navbar fija, el buscador flotante (`MorphSearch`, sólo en "/") y el pie.
 * Al bajar más de ~100 px el buscador viaja del hero al navbar.
 */
export const EstructuraDelSitio: Story = {
  name: "Estructura del sitio (home)",
  render: () => (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full">
        <Navbar categories={categories} />
      </header>
      <MorphSearch />
      <main className="container mx-auto flex-1 px-4 pt-11">
        <HomeContent
          categories={categories}
          stores={stores}
          trendingIds={[rowProducts[2].id ?? ""]}
          rows={[
            { key: "popular", title: "Lo más popular", href: "/explorar", products: rowProducts },
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
  ),
};
