import { CATEGORY_LABELS, categoryFromSlug } from "@framerate/contracts";

/** Nombre de una categoría por su slug, para cuando no se tiene la lista de la API a mano: es la misma fuente. */
export function categoryLabel(slug: string) {
  const category = categoryFromSlug(slug);
  return category ? CATEGORY_LABELS[category] : slug;
}

/** Foto de stock de la categoría (ver public/img/CREDITS.md). */
export const getCategoryImage = (slug: string) => `/img/categories/${slug}.jpg`;
