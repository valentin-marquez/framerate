import type { Meta, StoryObj } from "@storybook/react-vite";
import { sessions } from "~/shared/storybook/fixtures";
import { SupportContactPanel } from "./support-contact-panel";

/** El widget de Turnstile (captcha) sólo aparece con `VITE_TURNSTILE_SITE_KEY`; en Storybook no se carga. */
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
