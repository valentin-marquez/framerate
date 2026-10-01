import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  type StoreRatingStats,
  type StoreReview,
  type StoreReviewItem,
  type StoreReviewsListResponse,
  storeReviewKeys,
} from "~/features/store-reviews/services/store-reviews";
import { sessions } from "~/shared/storybook/fixtures";
import { LOADING, withQueryData } from "~/shared/storybook/with-query-data";
import { OwnerResponseForm } from "./owner-response-form";
import { RatingStars } from "./rating-stars";
import { RatingSummary } from "./rating-summary";
import { ReviewCard } from "./review-card";
import { ReviewForm } from "./review-form";
import { ReviewList } from "./review-list";
import { StoreReviewsSection } from "./store-reviews-section";

const meta = { title: "Tiendas/Reseñas", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const SLUG = "tectec";

const review = (id: string, extra: Partial<StoreReview>): StoreReview => ({
  id,
  rating: 5,
  comment: null,
  helpful_count: 0,
  is_pinned: false,
  owner_response: null,
  owner_response_at: null,
  created_at: "2026-09-12T15:00:00.000Z",
  edited_at: null,
  author: { username: "matias", full_name: "Matías", avatar_url: null },
  mine: false,
  voted_by_me: false,
  deleted: false,
  ...extra,
});

const pinned = review("r1", {
  comment: "Me llegó la RTX al día siguiente en Santiago. Bien embalada y con boleta.",
  helpful_count: 14,
  is_pinned: true,
  owner_response: "¡Gracias, Matías! Que la disfrutes.",
  owner_response_at: "2026-09-13T10:00:00.000Z",
});
const plain = review("r2", {
  rating: 3,
  comment: "Buen precio, pero el retiro en tienda tardó más de lo que decía la página.",
  helpful_count: 3,
  voted_by_me: true,
  author: { username: "fran", full_name: "Francisca", avatar_url: null },
  created_at: "2026-09-02T18:30:00.000Z",
});
const mine = review("r3", {
  rating: 4,
  comment: "Atención rápida por WhatsApp.",
  mine: true,
  author: { username: "ana", full_name: "Ana", avatar_url: null },
  created_at: "2026-08-20T12:00:00.000Z",
});
const deleted: StoreReviewItem = {
  id: "r4",
  deleted: true,
  deleted_reason: "spam",
  created_at: "2026-08-10T12:00:00.000Z",
  is_pinned: false,
};

const items: StoreReviewItem[] = [pinned, plain, mine, deleted];
const list = (data: StoreReviewItem[]): StoreReviewsListResponse => ({
  data,
  meta: { limit: 20, offset: 0, total: data.length, sort: "recent" },
});
const stats: StoreRatingStats = {
  avg_rating: 4.3,
  total_reviews: 12,
  distribution: { "1": 1, "2": 0, "3": 1, "4": 3, "5": 7 },
};

const withReviews = withQueryData([
  [storeReviewKeys.stats(SLUG), stats],
  [storeReviewKeys.list(SLUG, "recent", 20, 0), list(items)],
  [storeReviewKeys.list(SLUG, "recent", 50, 0), list(items)],
]);

export const Seccion: Story = {
  name: "Sección completa",
  parameters: { session: sessions.user },
  decorators: [withReviews],
  render: () => <StoreReviewsSection storeSlug={SLUG} />,
};

export const SeccionDuena: Story = {
  name: "Sección completa: vista de la tienda",
  parameters: { session: sessions.admin },
  decorators: [withReviews],
  render: () => <StoreReviewsSection storeSlug={SLUG} canManage />,
};

export const SeccionVacia: Story = {
  name: "Sección sin reseñas",
  parameters: { session: sessions.user },
  decorators: [
    withQueryData([
      [storeReviewKeys.stats(SLUG), { avg_rating: null, total_reviews: 0, distribution: stats.distribution }],
      [storeReviewKeys.list(SLUG, "recent", 20, 0), list([])],
      [storeReviewKeys.list(SLUG, "recent", 50, 0), list([])],
    ]),
  ],
  render: () => <StoreReviewsSection storeSlug={SLUG} />,
};

export const Resumen: Story = {
  name: "Resumen de calificación",
  decorators: [withReviews],
  render: () => <RatingSummary storeSlug={SLUG} />,
};

export const ResumenCargando: Story = {
  name: "Resumen de calificación cargando",
  decorators: [withQueryData([[storeReviewKeys.stats(SLUG), LOADING]])],
  render: () => <RatingSummary storeSlug={SLUG} />,
};

export const Lista: Story = {
  name: "Lista de reseñas",
  decorators: [withReviews],
  render: () => <ReviewList storeSlug={SLUG} />,
};

export const Tarjetas: Story = {
  name: "Tarjeta de reseña: estados",
  parameters: { session: sessions.user },
  render: () => (
    <div className="max-w-2xl space-y-3">
      <ReviewCard storeSlug={SLUG} review={pinned} />
      <ReviewCard storeSlug={SLUG} review={plain} />
      <ReviewCard storeSlug={SLUG} review={mine} />
      <ReviewCard storeSlug={SLUG} review={deleted} />
    </div>
  ),
};

export const TarjetaParaLaTienda: Story = {
  name: "Tarjeta de reseña: la tienda puede responder",
  parameters: { session: sessions.admin },
  render: () => (
    <div className="max-w-2xl space-y-3">
      <ReviewCard storeSlug={SLUG} review={plain} canManage />
      <ReviewCard storeSlug={SLUG} review={pinned} canManage />
    </div>
  ),
};

export const Formulario: Story = {
  name: "Formulario de reseña",
  parameters: { session: sessions.user },
  render: () => (
    <div className="grid max-w-2xl gap-4">
      <ReviewForm storeSlug={SLUG} />
      <ReviewForm storeSlug={SLUG} existing={mine} onDone={() => {}} />
    </div>
  ),
};

export const FormularioVisitante: Story = {
  name: "Formulario de reseña: visitante",
  render: () => <ReviewForm storeSlug={SLUG} />,
};

export const RespuestaDeLaTienda: Story = {
  name: "Respuesta de la tienda",
  render: () => (
    <div className="grid max-w-2xl gap-4">
      <OwnerResponseForm storeSlug={SLUG} review={plain} onDone={() => {}} />
      <OwnerResponseForm storeSlug={SLUG} review={pinned} onDone={() => {}} />
    </div>
  ),
};

function InteractiveStars() {
  const [value, setValue] = useState(3);
  return <RatingStars value={value} size="lg" onChange={setValue} />;
}

export const Estrellas: Story = {
  render: () => (
    <div className="space-y-3">
      <RatingStars value={4.3} size="sm" />
      <RatingStars value={2} size="md" />
      <RatingStars value={0} size="lg" />
      <div className="flex items-center gap-3 text-muted-foreground text-sm">
        <InteractiveStars /> Interactivas
      </div>
    </div>
  ),
};
