import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ProviderIcon } from "~/features/auth/components/provider-icons";
import { Apple } from "./icons/apple";
import { Discord } from "./icons/discord";
import { Facebook } from "./icons/facebook";
import { Google } from "./icons/google";
import { Logo } from "./layout/logo";
import { OutboundLink } from "./outbound-link";
import { StoreLogo } from "./store-logo";

const meta = { title: "Fundamentos/Marca e íconos" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function HoverLogo() {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-xl p-2 text-foreground"
    >
      <Logo className="size-16" isHovered={hovered} />
    </button>
  );
}

export const Logotipo: Story = {
  render: () => (
    <div className="flex items-end gap-6 text-foreground">
      <Logo className="size-5" />
      <Logo className="size-8" />
      <Logo className="size-12 text-foreground/40" />
      <div className="space-y-1 text-center">
        <HoverLogo />
        <p className="text-muted-foreground text-xs">Pasa el cursor: gira el cuadro</p>
      </div>
    </div>
  ),
};

const PROVIDERS = [
  ["discord", Discord],
  ["google", Google],
  ["apple", Apple],
  ["facebook", Facebook],
] as const;

export const Proveedores: Story = {
  name: "Proveedores de login",
  render: () => (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-6">
        {PROVIDERS.map(([id, Icon]) => (
          <div key={id} className="flex flex-col items-center gap-2">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-neutral-900">
              <Icon className="size-7" />
            </div>
            <code className="font-mono text-muted-foreground text-xs">{id}</code>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">ProviderIcon (ajusta el ícono de Apple al tema)</p>
        <div className="flex items-center gap-4 text-foreground">
          {PROVIDERS.map(([id]) => (
            <ProviderIcon key={id} id={id} />
          ))}
        </div>
      </div>
    </div>
  ),
};

// Ícono inline: en Storybook no hay bucket de íconos. La URL inválida muestra la caída al monograma.
const ICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#111"/><text x="32" y="42" font-family="sans-serif" font-size="30" font-weight="700" fill="#fff" text-anchor="middle">T</text></svg>',
)}`;

const STORES = [
  { name: "TecTec", slug: "tectec", icon_url: ICON },
  { name: "Dust2", slug: "dust2", icon_url: null },
  { name: "PC Express", slug: "pc-express", icon_url: null },
  { name: "SP Digital", slug: "sp-digital", icon_url: "https://ejemplo.invalid/icono.png" },
];

export const LogosDeTienda: Story = {
  name: "Logos de tienda",
  render: () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        {STORES.map((store) => (
          <div key={store.slug} className="flex flex-col items-center gap-2">
            <StoreLogo store={store} className="size-12 rounded-xl" />
            <span className="text-muted-foreground text-xs">{store.name}</span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Sin ícono o si falla la carga, cae a un monograma con color fijo por tienda.
      </p>
      <div className="flex items-end gap-3">
        <StoreLogo store={STORES[1]} className="size-6 rounded-md" />
        <StoreLogo store={STORES[1]} />
        <StoreLogo store={STORES[1]} className="size-16 rounded-xl" />
      </div>
    </div>
  ),
};

export const EnlaceATienda: Story = {
  name: "Enlace a tienda",
  render: () => (
    <p className="text-foreground text-sm">
      Revisa el precio en{" "}
      <OutboundLink
        href="https://tectec.cl/producto/rtx-5060"
        source="product_details_hero"
        track={false}
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        TecTec
      </OutboundLink>
      : abre otra pestaña y agrega los utm_* al enlace.
    </p>
  ),
};
