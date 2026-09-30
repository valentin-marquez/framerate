import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconCompass, IconCpu } from "@tabler/icons-react";
import { useEffect } from "react";
import { useAuthStore } from "~/features/auth/store/auth";
import { categories } from "~/shared/storybook/fixtures";
import { NavClock, NavTab } from "./nav-parts";
import { Navbar } from "./navbar";
import { SiteFooter } from "./site-footer";

const meta = { title: "Layout/Navegación", id: "layout", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Fija (o limpia) la sesión del store mientras la historia está montada. */
function WithSession({ signedIn, children }: { signedIn: boolean; children: React.ReactNode }) {
  useEffect(() => {
    useAuthStore.setState(
      signedIn
        ? {
            user: {
              id: "u1",
              email: "ana@framerate.cl",
              username: "ana",
              displayName: "Ana",
              avatarUrl: null,
              bio: null,
              lang: "es",
              theme: "system",
              role: "user",
              createdAt: "2026-01-01T00:00:00.000Z",
              ban: null,
            },
            profile: {
              id: "u1",
              username: "ana",
              full_name: "Ana",
              avatar_url: null,
              bio: null,
              lang: "es",
              created_at: "",
              updated_at: "",
            },
          }
        : { user: null, profile: null },
    );
    return () => useAuthStore.setState({ user: null, profile: null });
  }, [signedIn]);
  return <>{children}</>;
}

export const NavbarVisitante: Story = {
  name: "Navbar · visitante",
  render: () => (
    <WithSession signedIn={false}>
      <div className="h-40">
        <Navbar categories={categories} />
      </div>
    </WithSession>
  ),
};

export const NavbarConSesion: Story = {
  name: "Navbar · con sesión",
  render: () => (
    <WithSession signedIn>
      <div className="h-40">
        <Navbar categories={categories} />
      </div>
    </WithSession>
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
