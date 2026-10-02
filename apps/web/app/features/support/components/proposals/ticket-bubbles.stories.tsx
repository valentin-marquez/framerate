import type { TicketDetail, TicketMessage } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { sessions } from "~/shared/storybook/fixtures";
import { TicketThread } from "../ticket-thread";
import { TicketBubbles } from "./ticket-bubbles";

/** #50: la conversación de un ticket. A la izquierda la burbuja de hoy; a la derecha, con los metadatos fuera. */
const meta = {
  title: "Cuenta/Mis tickets: burbujas",
  parameters: { layout: "padded", session: sessions.user },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const message = (id: number, role: TicketMessage["authorRole"], body: string, createdAt: string): TicketMessage => ({
  id,
  authorRole: role,
  body,
  isInternal: false,
  createdAt,
});

const messages: TicketMessage[] = [
  message(
    1,
    "user",
    "La RTX 4070 aparece a $549.990 en la ficha, pero en la tienda está a $599.990.",
    "2026-09-28T14:05:00.000Z",
  ),
  message(
    2,
    "staff",
    "Gracias por avisar. La tienda cambió el precio después de la última lectura; ya lo actualizamos.",
    "2026-09-29T10:20:00.000Z",
  ),
  message(
    3,
    "staff",
    "Si lo ves distinto en unas horas, avísanos y lo revisamos de nuevo.",
    "2026-09-29T10:22:00.000Z",
  ),
  message(4, "user", "Perfecto, ya lo veo bien. Gracias.", "2026-09-29T15:41:00.000Z"),
];

const ticket: TicketDetail = {
  id: "T-7K3M9Q",
  category: "store_issue",
  subject: "El precio de una tienda no coincide",
  status: "waiting_user",
  createdAt: "2026-09-28T14:05:00.000Z",
  updatedAt: "2026-09-29T15:41:00.000Z",
  lastMessageAt: "2026-09-29T15:41:00.000Z",
  messages,
};

const Frame = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <p className="font-medium text-muted-foreground text-sm">{title}</p>
    <div className="overflow-hidden rounded-3xl border border-border bg-card">{children}</div>
  </div>
);

export const ActualContraPropuesta: Story = {
  name: "Actual contra metadatos fuera",
  render: () => (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
      <Frame title="Hoy">
        <TicketThread ticket={ticket} />
      </Frame>
      <Frame title="Metadatos fuera y mensajes agrupados">
        <TicketBubbles messages={messages} />
      </Frame>
    </div>
  ),
};
