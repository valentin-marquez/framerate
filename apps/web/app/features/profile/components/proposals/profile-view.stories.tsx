import type { PublicProfile } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { sessions } from "~/shared/storybook/fixtures";
import { ProfileView } from "./profile-view";

/** #50: /perfil y /u/:username en el sistema nuevo, sin la portada de `getGradient` ni separadores. */
const meta = { title: "Cuenta/Perfil: propuesta", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const ana: PublicProfile = {
  username: "ana",
  displayName: "Ana Rojas",
  avatarUrl: "https://cdn.discordapp.com/embed/avatars/1.png",
  bio: "Armo PCs para streaming en Valparaíso. Fan de las fuentes silenciosas y de los gabinetes chicos.",
  createdAt: "2026-09-04T12:00:00.000Z",
};

export const Propio: Story = {
  name: "Perfil propio",
  parameters: { session: sessions.user },
  render: () => <ProfileView profile={ana} isOwner />,
};

export const Publico: Story = {
  name: "Perfil público, visitante",
  render: () => <ProfileView profile={ana} isOwner={false} />,
};

export const SinFotoNiBio: Story = {
  name: "Sin foto ni bio",
  render: () => <ProfileView profile={{ ...ana, avatarUrl: null, bio: null }} isOwner={false} />,
};

export const NombreLargo: Story = {
  name: "Nombre largo",
  render: () => (
    <ProfileView
      profile={{ ...ana, displayName: "María Ignacia de los Ángeles Fernández Cortés", username: "mariaignacia_fc" }}
      isOwner
    />
  ),
};
