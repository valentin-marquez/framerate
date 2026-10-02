import type { PublicProfile, QuoteSummary } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { sessions } from "~/shared/storybook/fixtures";
import { ProfileView } from "./profile-view";

/** #50: /perfil y /u/:username en el sistema nuevo, sin la portada de `getGradient` ni separadores. A: cabecera. B: lateral. */
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

const author = { username: "ana", displayName: "Ana Rojas", avatarUrl: null };
const quote = (
  id: string,
  name: string,
  description: string | null,
  itemCount: number,
  visibility: QuoteSummary["visibility"],
  updatedAt: string,
): QuoteSummary => ({ id, name, description, itemCount, visibility, author, createdAt: updatedAt, updatedAt });

const quotes = [
  quote(
    "gamer-1440p",
    "Gamer 1440p",
    "Ryzen 7 con una RX 7800 XT, pensado para jugar a 1440p con todo en alto y dejar margen para actualizar la GPU.",
    9,
    "public",
    "2026-09-28T12:00:00.000Z",
  ),
  quote("streaming", "Streaming silencioso", null, 7, "unlisted", "2026-09-20T12:00:00.000Z"),
  quote(
    "oficina",
    "Oficina barata",
    "Para planillas y videollamadas, sin tarjeta de video dedicada.",
    1,
    "private",
    "2026-09-10T12:00:00.000Z",
  ),
];

export const CabeceraPropio: Story = {
  name: "A cabecera: perfil propio",
  parameters: { session: sessions.user },
  render: () => <ProfileView profile={ana} isOwner quotes={quotes} />,
};

export const CabeceraPublico: Story = {
  name: "A cabecera: público",
  render: () => <ProfileView profile={ana} isOwner={false} quotes={quotes.filter((q) => q.visibility === "public")} />,
};

export const LateralPropio: Story = {
  name: "B lateral: perfil propio",
  parameters: { session: sessions.user },
  render: () => <ProfileView profile={ana} isOwner quotes={quotes} layout="lateral" />,
};

export const LateralPublico: Story = {
  name: "B lateral: público",
  render: () => (
    <ProfileView
      profile={ana}
      isOwner={false}
      quotes={quotes.filter((q) => q.visibility === "public")}
      layout="lateral"
    />
  ),
};

export const SinCotizaciones: Story = {
  name: "Sin cotizaciones (propio)",
  parameters: { session: sessions.user },
  render: () => <ProfileView profile={ana} isOwner />,
};

export const SinFotoNiBio: Story = {
  name: "Sin foto ni bio",
  render: () => (
    <ProfileView profile={{ ...ana, avatarUrl: null, bio: null }} isOwner={false} quotes={quotes.slice(0, 1)} />
  ),
};

export const NombreLargo: Story = {
  name: "Nombre largo (lateral)",
  render: () => (
    <ProfileView
      profile={{ ...ana, displayName: "María Ignacia de los Ángeles Fernández Cortés", username: "mariaignacia_fc" }}
      isOwner
      quotes={quotes}
      layout="lateral"
    />
  ),
};
