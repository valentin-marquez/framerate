import { Link } from "react-router";
import type { Category } from "~/features/category/services/categories";
import { getCategoryConfig } from "~/features/category/utils/categories";

interface CategoryLinksProps {
  categories: Category[];
}

/**
 * Grid de links al pie (estilo "Inspiración para escapadas futuras" de Airbnb):
 * navegación densa por categoría, buena para SEO interno y para que el usuario
 * salte directo a explorar sin pasar por menús.
 */
export function CategoryLinks({ categories }: CategoryLinksProps) {
  if (categories.length === 0) return null;

  return (
    <section className="rounded-3xl border border-border/40 bg-card/50 p-6 md:p-8">
      <h2 className="text-xl font-semibold tracking-tight text-foreground mb-1">Explora todo el hardware</h2>
      <p className="text-sm text-muted-foreground mb-6">Navega por categoría y compara precios al instante.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
        {categories.map((category) => {
          const config = getCategoryConfig(category.slug);
          return (
            <Link
              key={category.id}
              to={`/categoria/${config.urlSlug}`}
              prefetch="intent"
              className="text-sm text-muted-foreground hover:text-primary transition-colors py-1"
            >
              {config.label}
            </Link>
          );
        })}
        <Link
          to="/explorar"
          prefetch="intent"
          className="text-sm font-medium text-foreground hover:text-primary transition-colors py-1"
        >
          Ver todos los productos →
        </Link>
      </div>
    </section>
  );
}
