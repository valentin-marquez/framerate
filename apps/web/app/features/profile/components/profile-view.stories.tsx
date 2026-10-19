import type { PublicProfile, QuoteSummary } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { sessions } from "~/shared/storybook/fixtures";
import { ProfileView } from "./profile-view";

/** /perfil y /u/:username en el sistema nuevo, sin portada de `getGradient` ni separadores. */
const meta = { title: "Cuenta/Perfil", parameters: { layout: "fullscreen" } } satisfies Meta;
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
): QuoteSummary => ({
  id,
  name,
  description,
  itemCount,
  likeCount: 0,
  visibility,
  author,
  createdAt: updatedAt,
  updatedAt,
});

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
  name: "Perfil propio",
  parameters: { session: sessions.user },
  render: () => <ProfileView profile={ana} isOwner quotes={quotes} />,
};

export const CabeceraPublico: Story = {
  name: "Público, visitante",
  render: () => <ProfileView profile={ana} isOwner={false} quotes={quotes.filter((q) => q.visibility === "public")} />,
};

export const SinCotizaciones: Story = {
  name: "Sin cotizaciones (propio)",
  parameters: { session: sessions.user },
  render: () => <ProfileView profile={ana} isOwner quotes={[]} />,
};

export const SinFotoNiBio: Story = {
  name: "Sin foto ni bio",
  render: () => (
    <ProfileView profile={{ ...ana, avatarUrl: null, bio: null }} isOwner={false} quotes={quotes.slice(0, 1)} />
  ),
};

export const NombreLargo: Story = {
  name: "Nombre largo",
  render: () => (
    <ProfileView
      profile={{ ...ana, displayName: "María Ignacia de los Ángeles Fernández Cortés", username: "mariaignacia_fc" }}
      isOwner
      quotes={quotes}
    />
  ),
};
