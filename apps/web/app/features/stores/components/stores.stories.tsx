import type { Meta, StoryObj } from "@storybook/react-vite";
import { rowProducts } from "~/shared/storybook/fixtures";
import type { ClaimRequest } from "../services/claims";
import type { StoreDetail, StoreMember, StoreProductCategory } from "../services/stores";
import { ClaimWizard } from "./claim-wizard";
import { DnsInstructions } from "./dns-instructions";
import { StoreHeader } from "./store-header";
import { StoreMemberList } from "./store-member-list";
import { StorePicker } from "./store-picker";
import { StoreProductsSection } from "./store-products-section";
import { VerifyStatus } from "./verify-status";

const meta = { title: "Tiendas/Perfil y reclamo", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const store: StoreDetail = {
  id: "tectec",
  slug: "tectec",
  name: "TecTec",
  canonical_name: "TecTec",
  display_name: null,
  url: "https://tectec.cl",
  website: "https://tectec.cl",
  logo_url: null,
  icon_url: null,
  banner_url: null,
  description: "Tienda de hardware en Santiago con despacho a todo Chile.",
  social: {},
  is_active: true,
  appearance: "light",
  is_claimed: true,
  account: null,
  owner_user_id: null,
  verified_at: "2026-07-14T12:00:00.000Z",
  created_at: "2026-01-10T12:00:00.000Z",
  updated_at: "2026-09-01T12:00:00.000Z",
  member_count: 2,
  rating: { average: 4.3, count: 12, recent: { average: 3.8, count: 4 } },
};

export const Cabecera: Story = {
  name: "Cabecera de tienda",
  render: () => <StoreHeader store={store} productCount={128} />,
};

export const CabeceraSinReclamar: Story = {
  name: "Cabecera de tienda sin reclamar ni reseñas",
  render: () => (
    <StoreHeader
      store={{
        ...store,
        id: "dust2",
        slug: "dust2",
        name: "Dust2",
        description: null,
        website: null,
        verified_at: null,
        is_claimed: false,
        member_count: 0,
        rating: { average: null, count: 0, recent: { average: null, count: 0 } },
      }}
    />
  ),
};

const productCategories: StoreProductCategory[] = [
  { slug: "tarjetas-de-video", name: "Tarjetas de video", count: 48, products: rowProducts },
  { slug: "fuentes-de-poder", name: "Fuentes de poder", count: 12, products: rowProducts.slice(4) },
];

export const Productos: Story = {
  name: "Productos de la tienda",
  render: () => <StoreProductsSection categories={productCategories} total={60} />,
};

export const ProductosVacio: Story = {
  name: "Productos de la tienda: vacío",
  render: () => <StoreProductsSection categories={[]} total={0} />,
};

const members: StoreMember[] = [
  {
    userId: "u1",
    username: "ana",
    displayName: "Ana",
    avatarUrl: null,
    role: "owner",
    createdAt: "2026-07-14T12:00:00Z",
  },
  {
    userId: "u2",
    username: "matias",
    displayName: "Matías",
    avatarUrl: null,
    role: "admin",
    createdAt: "2026-08-01T12:00:00Z",
  },
  {
    userId: "u3",
    username: "fran",
    displayName: "Francisca",
    avatarUrl: null,
    role: "editor",
    createdAt: "2026-08-20T12:00:00Z",
  },
];

export const Miembros: Story = {
  render: () => (
    <div className="grid max-w-md gap-6">
      <StoreMemberList slug="tectec" members={members} currentUserIsOwner token="" />
      <StoreMemberList slug="tectec" members={members} currentUserIsOwner={false} token="" />
      <StoreMemberList slug="tectec" members={[]} currentUserIsOwner token="" />
    </div>
  ),
};

const TXT = { txtName: "_framerate-verify.tectec.cl", txtValue: "framerate-verify=7f3a9c2e41d84b6f" };

export const InstruccionesDns: Story = {
  name: "Instrucciones DNS",
  render: () => (
    <div className="grid max-w-2xl gap-6">
      <DnsInstructions
        {...TXT}
        domain="tectec.cl"
        dnsProvider="cloudflare"
        dnsNameservers={["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"]}
      />
      <DnsInstructions {...TXT} domain="tectec.cl" dnsProvider={null} />
    </div>
  ),
};

const verify = { expected: TXT.txtValue, domain: "tectec.cl", lastCheckedAt: Date.now() - 12_000 };

export const EstadoDeVerificacion: Story = {
  name: "Estado de la verificación",
  render: () => (
    <div className="grid max-w-2xl gap-3">
      <VerifyStatus {...verify} status="waiting" found={[]} checking />
      <VerifyStatus {...verify} status="found" found={[TXT.txtValue]} checking={false} />
      <VerifyStatus {...verify} status="mismatch" found={[`${TXT.txtValue} `]} checking={false} />
      <VerifyStatus {...verify} status="mismatch" found={["framerate-verify=7f3a9c2e"]} checking={false} />
      <VerifyStatus {...verify} status="error" found={[]} checking={false} />
    </div>
  ),
};

export const SelectorDeTienda: Story = {
  name: "Selector de tienda",
  // Pide la lista directo a la API (sin React Query): en Storybook, sin API, queda en su estado de error.
  render: () => <StorePicker onSelect={() => {}} />,
};

const claim = (status: ClaimRequest["status"]): ClaimRequest => ({
  id: "cl1",
  store_id: "tectec",
  store_name: "TecTec",
  claimed_domain: "tectec.cl",
  txt_record_name: TXT.txtName,
  txt_record_value: TXT.txtValue,
  status,
  attempts: 3,
  last_checked_at: null,
  verified_at: status === "verified" ? "2026-09-30T12:00:00Z" : null,
  expires_at: "2026-10-07T12:00:00Z",
  created_at: "2026-09-30T11:00:00Z",
  dns_provider: "cloudflare",
  dns_nameservers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
});

export const ReclamoPasoDns: Story = {
  name: "Reclamo: paso DNS",
  // El wizard revisa el DNS contra la API cada pocos segundos; sin API muestra el aviso de reintento.
  render: () => <ClaimWizard token="" initialClaim={claim("pending")} />,
};

export const ReclamoVerificado: Story = {
  name: "Reclamo: dominio verificado",
  render: () => <ClaimWizard token="" initialClaim={claim("verified")} />,
};
