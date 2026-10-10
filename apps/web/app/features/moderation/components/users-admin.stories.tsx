import type { AdminUser, AdminUserPage, ModerationAction } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Navbar } from "~/shared/components/layout/navbar";
import { categories, freshness, sessions } from "~/shared/storybook/fixtures";
import { UsersAdminView } from "./users-admin-view";

/** /admin/users dentro del armado del sitio (#160). */
const meta = {
  title: "Admin/Usuarios",
  parameters: { layout: "fullscreen", session: sessions.admin, path: "/admin/users" },
  decorators: [
    (Story) => (
      <div className="flex min-h-screen flex-col pb-16">
        <Navbar categories={categories} freshness={freshness} initialCollapsed={false} />
        <div className="flex flex-1 flex-col lg:pl-64">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const user = (id: string, displayName: string, role: AdminUser["role"], extra: Partial<AdminUser> = {}): AdminUser => ({
  id,
  username: displayName.toLowerCase().replace(/\W+/g, ""),
  displayName,
  email: `${displayName.toLowerCase().replace(/\W+/g, ".")}@gmail.com`,
  role,
  providers: ["discord"],
  createdAt: "2026-09-12T15:20:00.000Z",
  lastSeenAt: "2026-10-10T18:02:00.000Z",
  ban: null,
  ...extra,
});

const items: AdminUser[] = [
  user("1", "Fernanda Soto", "user", {
    providers: ["google"],
    lastSeenAt: null,
    createdAt: "2026-10-10T09:00:00.000Z",
  }),
  user("2", "Camila Rojas", "support", { providers: ["google", "discord"] }),
  user("3", "Matías", "user", { lastSeenAt: "2026-10-09T22:41:00.000Z" }),
  user("4", "spam bot 42", "user", { ban: { reason: "Reseñas falsas en tres tiendas", expiresAt: null } }),
  user("5", "Diego", "user", { ban: { reason: "Insultos en comentarios", expiresAt: "2026-10-17T00:00:00.000Z" } }),
  user("6", "Ignacio", "moderator"),
  user("7", "Ana", "admin", { id: "u1", createdAt: "2026-09-01T12:00:00.000Z" }),
];

const data: AdminUserPage = {
  items,
  hasMore: true,
  counts: { all: 312, staff: 3, user: 309, support: 1, moderator: 1, admin: 1, banned: 2 },
};

const history: ModerationAction[] = [
  {
    id: 1,
    actor: { id: "6", username: "ignacio", displayName: "Ignacio" },
    action: "user_banned",
    targetType: "user",
    targetId: "4",
    reportId: null,
    reason: "Reseñas falsas en tres tiendas",
    before: null,
    after: { expiresAt: null },
    createdAt: "2026-10-03T20:10:00.000Z",
  },
];

const base = { data, q: "", filter: "all" as const, page: 1, selected: null, history: [], currentUserId: "u1" };

export const Lista: Story = { render: () => <UsersAdminView {...base} /> };

export const ConFicha: Story = {
  name: "Con la ficha de un usuario",
  render: () => <UsersAdminView {...base} selected={items[2] ?? null} />,
};

export const Suspendido: Story = {
  name: "Usuario suspendido, con historial",
  render: () => <UsersAdminView {...base} selected={items[3] ?? null} history={history} />,
};

export const Movil: Story = {
  name: "Móvil",
  globals: { viewport: { value: "mobile1", isRotated: false } },
  render: () => <UsersAdminView {...base} />,
};
