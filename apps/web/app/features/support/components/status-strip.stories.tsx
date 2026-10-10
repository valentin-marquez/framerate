import type { HealthIncident } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AdminTabs } from "~/shared/components/layout/admin-tabs";
import { sessions } from "~/shared/storybook/fixtures";
import { StatusStrip } from "./status-strip";

/** La cabecera de /admin/support (#160): pestañas según el rol y la franja con el estado de los sistemas. */
const meta = {
  title: "Admin/Soporte: estado",
  parameters: { session: sessions.support, path: "/admin/support" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const incident = (id: string, severity: HealthIncident["severity"], title: string): HealthIncident => ({
  id,
  system: "scraping",
  severity,
  title,
  detail: null,
  at: "2026-10-10T16:00:00.000Z",
  durationMs: null,
  href: "/admin/estado",
});

const Header = ({ incidents }: { incidents: HealthIncident[] }) => (
  <div className="max-w-4xl space-y-4">
    <AdminTabs current="/admin/support" />
    <StatusStrip incidents={incidents} />
  </div>
);

export const ConErrores: Story = {
  name: "Con un error y avisos",
  render: () => (
    <Header
      incidents={[
        incident("a", "error", "MyBox, Discos SSD"),
        incident("b", "warning", "Revisiones de matching pendientes"),
        incident("c", "warning", "36 ofertas fallidas en normalización"),
      ]}
    />
  ),
};

export const SoloAvisos: Story = {
  name: "Sólo avisos",
  render: () => <Header incidents={[incident("b", "warning", "Revisiones de matching pendientes")]} />,
};

export const TodoEnOrden: Story = { name: "Todo en orden", render: () => <Header incidents={[]} /> };
