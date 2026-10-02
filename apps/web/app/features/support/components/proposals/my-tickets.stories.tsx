import type { Ticket, TicketDetail } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { sessions } from "~/shared/storybook/fixtures";
import { MyTickets } from "./my-tickets";

/** #50: /ajustes/tickets en el sistema nuevo. Va dentro del layout de Ajustes (título y pestañas), que ya existe. */
const meta = {
  title: "Cuenta/Mis tickets: propuesta",
  parameters: { layout: "padded", session: sessions.user },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const ticket = (
  id: string,
  category: Ticket["category"],
  subject: string,
  status: Ticket["status"],
  last: string,
): Ticket => ({
  id,
  category,
  subject,
  status,
  createdAt: "2026-09-20T12:00:00.000Z",
  updatedAt: last,
  lastMessageAt: last,
});

const tickets: Ticket[] = [
  ticket("T-7K3M9Q", "store_issue", "El precio de una tienda no coincide", "waiting_user", "2026-09-29T10:20:00.000Z"),
  ticket(
    "T-2HX8LP",
    "bug",
    "El filtro de marca no se queda marcado al volver",
    "in_progress",
    "2026-09-30T18:02:00.000Z",
  ),
  ticket("T-9QW1ZC", "feature", "Avisarme cuando baje el precio de una fuente", "open", "2026-10-01T09:15:00.000Z"),
  ticket("T-5MN4RT", "data_request", "Quiero descargar mis datos", "resolved", "2026-09-12T16:40:00.000Z"),
  ticket("T-1AB2CD", "other", "No me llega el correo de inicio de sesión", "closed", "2026-08-30T11:00:00.000Z"),
];

const thread: TicketDetail = {
  ...tickets[0],
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

export const ConTickets: Story = {
  name: "Con tickets, uno abierto",
  render: () => <MyTickets tickets={tickets} threads={{ [thread.id]: thread }} />,
};

export const Cerrados: Story = {
  name: "Sólo cerrados",
  render: () => <MyTickets tickets={tickets.slice(3)} />,
};

export const SinTickets: Story = {
  name: "Sin tickets",
  render: () => <MyTickets tickets={[]} />,
};
