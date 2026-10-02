import type { Ticket, TicketDetail, TicketMessage } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { sessions } from "~/shared/storybook/fixtures";
import { MyTickets } from "./my-tickets";

/**
 * #50: /ajustes/tickets en el sistema nuevo, con tres formas de leer la conversación sin modal: bandeja de dos
 * paneles, página propia del ticket y chat acoplado abajo.
 */
const meta = {
  title: "Cuenta/Mis tickets: propuesta",
  parameters: { layout: "padded", session: sessions.user },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-5xl">
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

const message = (id: number, role: TicketMessage["authorRole"], body: string, createdAt: string): TicketMessage => ({
  id,
  authorRole: role,
  body,
  isInternal: false,
  createdAt,
});

const conversations: Record<string, TicketMessage[]> = {
  "T-7K3M9Q": [
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
  ],
  "T-2HX8LP": [
    message(
      1,
      "user",
      "Elijo una marca en /explorar, abro una ficha y al volver el filtro desapareció.",
      "2026-09-30T09:12:00.000Z",
    ),
    message(
      2,
      "staff",
      "Lo reproducimos, estamos en eso. Te avisamos cuando esté corregido.",
      "2026-09-30T18:02:00.000Z",
    ),
  ],
  "T-9QW1ZC": [
    message(
      1,
      "user",
      "Sería útil que me avisaran por correo cuando una fuente de poder que guardé baje de precio.",
      "2026-10-01T09:15:00.000Z",
    ),
  ],
  "T-5MN4RT": [
    message(1, "user", "Quiero descargar todos los datos que tienen de mi cuenta.", "2026-09-10T08:00:00.000Z"),
    message(2, "staff", "Listo, te enviamos el archivo al correo de tu cuenta.", "2026-09-12T16:40:00.000Z"),
  ],
  "T-1AB2CD": [
    message(1, "user", "No me llega el correo para iniciar sesión.", "2026-08-29T20:30:00.000Z"),
    message(
      2,
      "staff",
      "Revisamos y era la carpeta de spam. Si vuelve a pasar, escríbenos.",
      "2026-08-30T11:00:00.000Z",
    ),
  ],
};

const threads: Record<string, TicketDetail> = Object.fromEntries(
  tickets.map((t) => [t.id, { ...t, messages: conversations[t.id] ?? [] }]),
);

export const BandejaAbierta: Story = {
  name: "A Bandeja: ticket abierto",
  render: () => <MyTickets tickets={tickets} threads={threads} variant="bandeja" initial="T-7K3M9Q" />,
};

export const BandejaVacia: Story = {
  name: "A Bandeja: sin elegir",
  render: () => <MyTickets tickets={tickets} threads={threads} variant="bandeja" />,
};

export const PaginaLista: Story = {
  name: "B Página: la lista",
  render: () => <MyTickets tickets={tickets} threads={threads} variant="pagina" />,
};

export const PaginaAbierta: Story = {
  name: "B Página: ticket abierto",
  render: () => <MyTickets tickets={tickets} threads={threads} variant="pagina" initial="T-7K3M9Q" />,
};

export const DockAbierto: Story = {
  name: "C Chat acoplado: abierto",
  render: () => <MyTickets tickets={tickets} threads={threads} variant="dock" initial="T-7K3M9Q" />,
};

export const SoloCerrados: Story = {
  name: "Sólo cerrados",
  render: () => <MyTickets tickets={tickets.slice(3)} threads={threads} />,
};

export const SinTickets: Story = {
  name: "Sin tickets",
  render: () => <MyTickets tickets={[]} />,
};
