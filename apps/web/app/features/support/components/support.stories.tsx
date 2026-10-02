import type { TicketDetail } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { sessions } from "~/shared/storybook/fixtures";
import { SupportContactPanel } from "./support-contact-panel";
import { TicketThread } from "./ticket-thread";

/**
 * El widget de Turnstile (captcha) sólo aparece con `VITE_TURNSTILE_SITE_KEY`; sin ella, el visitante ve el
 * aviso para iniciar sesión o escribir al correo.
 */
const meta = { title: "Cuenta/Soporte", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const PanelVisitante: Story = {
  name: "Panel de contacto: visitante",
  render: () => (
    <div className="max-w-2xl">
      <SupportContactPanel defaultCategory="privacy" />
    </div>
  ),
};

export const PanelConSesion: Story = {
  name: "Panel de contacto: con sesión",
  parameters: { session: sessions.user },
  render: () => (
    <div className="max-w-2xl">
      <SupportContactPanel defaultCategory="bug" triggerLabel="Reportar un problema" />
    </div>
  ),
};

const ticket: TicketDetail = {
  id: "T-7K3M9Q",
  category: "store_issue",
  subject: "El precio de una tienda no coincide",
  status: "waiting_user",
  createdAt: "2026-09-28T14:05:00.000Z",
  updatedAt: "2026-09-29T10:20:00.000Z",
  lastMessageAt: "2026-09-29T10:20:00.000Z",
  messages: [
    {
      id: 1,
      authorRole: "user",
      body: "La RTX 4070 aparece a $549.990 en la ficha, pero en la tienda está a $599.990.",
      isInternal: false,
      createdAt: "2026-09-28T14:05:00.000Z",
    },
    {
      id: 2,
      authorRole: "staff",
      body: "Gracias por avisar. La tienda cambió el precio después de la última lectura; ya lo actualizamos.",
      isInternal: false,
      createdAt: "2026-09-29T10:20:00.000Z",
    },
  ],
};

const hilo = (t: TicketDetail) => (
  <div className="max-w-2xl overflow-hidden rounded-2xl border border-border bg-card">
    <TicketThread ticket={t} />
  </div>
);

export const Hilo: Story = { name: "Hilo de un ticket", render: () => hilo(ticket) };

export const HiloCerrado: Story = {
  name: "Hilo de un ticket: cerrado",
  render: () => hilo({ ...ticket, status: "closed" }),
};
