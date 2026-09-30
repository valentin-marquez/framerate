import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconBrandDiscord, IconLanguage, IconLock, IconMail } from "@tabler/icons-react";
import { Button } from "~/shared/components/primitives/button";
import { SettingsBadge, SettingsGroup, SettingsRow, SettingsSection } from "./settings-parts";

const meta = { title: "Cuenta/Ajustes", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Secciones: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl space-y-8">
      <SettingsSection
        title="Correos"
        description="El correo principal lo administra tu proveedor de inicio de sesión."
      >
        <SettingsGroup>
          <SettingsRow
            icon={IconMail}
            title="ana@framerate.cl"
            badge={<SettingsBadge>Principal</SettingsBadge>}
            description="Gestionado por Discord"
          />
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection title="Cuentas conectadas" description="Vincula proveedores para iniciar sesión.">
        <SettingsGroup>
          <SettingsRow
            icon={IconBrandDiscord}
            title="Discord"
            badge={<SettingsBadge>Conectado</SettingsBadge>}
            description="ana#1234"
          />
          <SettingsRow
            icon={IconLock}
            title="Clave de acceso"
            description="Inicia sesión sin contraseña con tu dispositivo."
            action={<Button size="sm">Añadir</Button>}
          />
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection title="Idioma" description="Elige el idioma del sitio.">
        <SettingsGroup>
          <SettingsRow
            icon={IconLanguage}
            title="Idioma"
            action={
              <Button variant="secondary" size="sm">
                Español
              </Button>
            }
          />
        </SettingsGroup>
      </SettingsSection>
    </div>
  ),
};
