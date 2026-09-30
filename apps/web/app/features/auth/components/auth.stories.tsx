import type { Meta, StoryObj } from "@storybook/react-vite";
import { Dialog } from "~/shared/components/primitives/dialog";
import { LoginCard, LoginDialog } from "./login-dialog";

const meta = {
  title: "Cuenta/Login",
  // Los proveedores salen del loader raíz; aquí se simulan Discord y Google para ver la jerarquía de botones.
  parameters: {
    providers: [
      { id: "discord", label: "Discord" },
      { id: "google", label: "Google" },
    ],
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Tarjeta: Story = {
  render: () => (
    <Dialog>
      <div className="max-w-sm overflow-hidden rounded-3xl border border-border bg-card">
        <LoginCard />
      </div>
    </Dialog>
  ),
};

export const TarjetaParaReclamar: Story = {
  name: "Tarjeta · al reclamar una tienda",
  render: () => (
    <Dialog>
      <div className="max-w-sm overflow-hidden rounded-3xl border border-border bg-card">
        <LoginCard
          title="Inicia sesión para reclamar"
          description="Verifica la propiedad con una cuenta para gestionar la tienda después."
        />
      </div>
    </Dialog>
  ),
};

export const Dialogo: Story = {
  name: "Diálogo",
  render: () => (
    <LoginDialog
      trigger={
        <button type="button" className="rounded-full bg-secondary px-3.5 py-1.5 font-medium text-sm">
          Entrar
        </button>
      }
    />
  ),
};
