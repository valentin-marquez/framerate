import type { Meta, StoryObj } from "@storybook/react-vite";
import { Dialog } from "~/shared/components/primitives/dialog";
import { Toaster } from "~/shared/components/primitives/sonner";
import { AuthFlash } from "./auth-flash";
import { AuthProvidersList } from "./auth-providers-list";
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

export const UnSoloProveedor: Story = {
  name: "Tarjeta con un solo proveedor",
  parameters: { providers: [{ id: "discord", label: "Discord" }] },
  render: Tarjeta.render,
};

export const ProveedoresSinIcono: Story = {
  name: "Lista con proveedores sin ícono propio",
  parameters: {
    providers: [
      { id: "google", label: "Google" },
      { id: "apple", label: "Apple" },
      { id: "facebook", label: "Facebook" },
      { id: "github", label: "GitHub" },
    ],
  },
  render: () => <AuthProvidersList returnTo="/" className="max-w-sm" />,
};

// `AuthFlash` lee lo que deja la vuelta de OAuth en la URL, muestra el aviso y limpia los parámetros.
const flash = (name: string, path: string): Story => ({
  name,
  parameters: { path },
  render: () => (
    <>
      <Toaster />
      <AuthFlash />
      <p className="text-muted-foreground text-sm">El aviso aparece abajo a la derecha al cargar la historia.</p>
    </>
  ),
});

export const AvisoErrorDeLogin = flash("Aviso: error al entrar", "/?error=account_not_linked");
export const AvisoCancelado = flash("Aviso: login cancelado", "/?error=access_denied");
export const AvisoCuentaConectada = flash("Aviso: cuenta conectada", "/ajustes?conectada=google");
export const AvisoUsuariosUnidos = flash("Aviso: usuarios unidos", "/ajustes?unidas");

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
