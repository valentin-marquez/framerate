import type { Claim, StoreDetail } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  type StoreRatingStats,
  type StoreReview,
  storeReviewKeys,
} from "~/features/store-reviews/services/store-reviews";
import { rowProducts, sessions } from "~/shared/storybook/fixtures";
import { withQueryData } from "~/shared/storybook/with-query-data";
import type { ClaimRequest } from "../../services/claims";
import type { StoreProductCategory } from "../../services/stores";
import { ClaimPage } from "./claim-page";
import { StorePage } from "./store-page";

/** #50: tienda y reclamo en el sistema nuevo. Las historias del diseño anterior siguen en "Tiendas/Perfil y reclamo". */
const meta = { title: "Tiendas/Tienda y reclamo: propuesta", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const store: StoreDetail = {
  slug: "tectec",
  name: "TecTec",
  canonicalName: "TecTec",
  displayName: null,
  url: "https://tectec.cl",
  website: "https://www.tectec.cl",
  description:
    "Tienda de hardware en Santiago con despacho a todo Chile. Armamos tu PC sin costo si compras las piezas.",
  social: { instagram: "tectec.cl" },
  iconUrl: null,
  bannerUrl: null,
  isActive: true,
  isClaimed: true,
  verifiedAt: "2026-07-14T12:00:00.000Z",
  frozen: false,
  createdAt: "2026-01-10T12:00:00.000Z",
  offerCount: 60,
  memberCount: 2,
  rating: { average: 4.3, count: 12, recent: { average: 3.8, count: 4 } },
};

const unclaimed: StoreDetail = {
  ...store,
  slug: "dust2",
  name: "Dust2",
  canonicalName: "Dust2",
  website: null,
  description: null,
  isClaimed: false,
  verifiedAt: null,
  offerCount: 0,
  memberCount: 0,
  rating: { average: null, count: 0, recent: { average: null, count: 0 } },
};

const categories: StoreProductCategory[] = [
  { slug: "tarjetas-de-video", name: "Tarjetas de video", count: 48, products: rowProducts },
  { slug: "fuentes-de-poder", name: "Fuentes de poder", count: 12, products: rowProducts.slice(4) },
];

const review = (id: string, rating: number, comment: string, username: string, extra: Partial<StoreReview> = {}) => ({
  id,
  rating,
  comment,
  helpful_count: 0,
  is_pinned: false,
  owner_response: null,
  owner_response_at: null,
  created_at: "2026-09-12T15:00:00.000Z",
  edited_at: null,
  author: { username, full_name: username, avatar_url: null },
  mine: false,
  voted_by_me: false,
  deleted: false as const,
  ...extra,
});

const reviews = [
  review("r1", 5, "Me llegó la RTX al día siguiente en Santiago. Bien embalada y con boleta.", "matias", {
    helpful_count: 14,
    owner_response: "¡Gracias, Matías! Que la disfrutes.",
    owner_response_at: "2026-09-13T10:00:00.000Z",
  }),
  review("r2", 3, "Buen precio, pero el retiro en tienda tardó más de lo que decía la página.", "fran", {
    created_at: "2026-09-02T18:30:00.000Z",
  }),
];
const stats: StoreRatingStats = {
  avg_rating: 4.3,
  total_reviews: 12,
  distribution: { "1": 1, "2": 0, "3": 1, "4": 3, "5": 7 },
};
const reviewData = (slug: string, items: typeof reviews, s: StoreRatingStats) => {
  const list = { data: items, meta: { limit: 20, offset: 0, total: items.length, sort: "recent" as const } };
  return withQueryData([
    [storeReviewKeys.stats(slug), s],
    [storeReviewKeys.pages(slug, "recent"), { pages: [list], pageParams: [0] }],
    [storeReviewKeys.list(slug, "recent", 50, 0), list],
  ]);
};
const noReviews: StoreRatingStats = {
  avg_rating: 0,
  total_reviews: 0,
  distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
};

export const TiendaVerificada: Story = {
  name: "Tienda verificada",
  decorators: [reviewData("tectec", reviews, stats)],
  render: () => <StorePage store={store} categories={categories} viewerRole={null} />,
};

export const TiendaSinReclamar: Story = {
  name: "Tienda sin reclamar, sin productos ni reseñas",
  decorators: [reviewData("dust2", [], noReviews)],
  render: () => <StorePage store={unclaimed} categories={[]} viewerRole={null} />,
};

export const TiendaAdministrada: Story = {
  name: "Tienda vista por quien la administra",
  parameters: { session: sessions.user },
  decorators: [reviewData("tectec", reviews, stats)],
  render: () => (
    <StorePage
      store={{ ...store, bannerUrl: "https://tectec.cl/wp-content/uploads/2022/03/RTX-3050-MSI-Ventus-2X-6gb_1.jpg" }}
      categories={categories}
      viewerRole="owner"
    />
  ),
};

const claim = (id: number, storeSlug: string, storeName: string, status: Claim["status"], created: string): Claim => ({
  id,
  storeSlug,
  storeName,
  domain: `${storeSlug}.cl`,
  txtName: `_framerate-verify.${storeSlug}.cl`,
  txtValue: "framerate-verify=7f3a9c2e41d84b6f",
  status,
  attempts: 3,
  lastCheckedAt: null,
  verifiedAt: null,
  expiresAt: "2026-10-07T12:00:00Z",
  createdAt: created,
  dnsProvider: "cloudflare",
});

const claims: Claim[] = [
  claim(3, "tectec", "TecTec", "pending", "2026-09-30T11:00:00Z"),
  claim(2, "nuevatec", "Nuevatec", "confirmed", "2026-08-02T11:00:00Z"),
  claim(1, "myshop", "MyShop", "expired", "2026-06-20T11:00:00Z"),
];

// El asistente es el que ya existe y usa la forma de la web (snake_case); revisa el DNS contra la API cada pocos
// segundos, así que sin API muestra el aviso de reintento.
const pending: ClaimRequest = {
  id: "3",
  store_id: "tectec",
  store_name: "TecTec",
  claimed_domain: "tectec.cl",
  txt_record_name: "_framerate-verify.tectec.cl",
  txt_record_value: "framerate-verify=7f3a9c2e41d84b6f",
  status: "pending",
  attempts: 3,
  last_checked_at: null,
  verified_at: null,
  expires_at: "2026-10-07T12:00:00Z",
  created_at: "2026-09-30T11:00:00Z",
  dns_provider: "cloudflare",
  dns_nameservers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
};

export const ReclamoElegir: Story = {
  name: "Reclamo: elegir tienda",
  parameters: { session: sessions.user, path: "/reclamar" },
  render: () => <ClaimPage claims={[]} />,
};

export const ReclamoEnCurso: Story = {
  name: "Reclamo: paso DNS con reclamos anteriores",
  parameters: { session: sessions.user, path: "/reclamar" },
  render: () => <ClaimPage claims={claims} initialClaim={pending} />,
};
