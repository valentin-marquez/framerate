/**
 * Fase 2: Entry point provisorio para la sección de reseñas de tienda.
 * Cuando Fase 1 cree `store-page.tsx`, debe importar y montar
 * `<StoreReviewsSection storeSlug={...} />` directamente; esta ruta queda
 * solo como fallback hasta el merge.
 */

import { StoreReviewsSection } from "~/features/store-reviews/components/store-reviews-section";
import type { Route } from "./+types/store-reviews-page";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Reseñas de ${params.slug} | Framerate` },
    { name: "description", content: `Lee y escribe reseñas sobre ${params.slug} en Framerate.cl` },
  ];
}

export default function StoreReviewsPage({ params }: Route.ComponentProps) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Reseñas de {params.slug}</h1>
        <p className="text-sm text-muted-foreground">
          Comparte tu experiencia con esta tienda y ayuda a otros compradores.
        </p>
      </header>
      <StoreReviewsSection storeSlug={params.slug} />
    </main>
  );
}
