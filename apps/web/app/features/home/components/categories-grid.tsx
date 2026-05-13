import { IconCpu } from "@tabler/icons-react";
import type { Category } from "~/features/category/services/categories";
import { CategoryCard } from "./category-card";
import { SectionHeader } from "./section-header";

interface CategoriesGridProps {
  categories: Category[];
}

export function CategoriesGrid({ categories }: CategoriesGridProps) {
  if (categories.length === 0) return null;

  return (
    <section className="container mx-auto px-4">
      <SectionHeader
        icon={<IconCpu className="size-5" />}
        title="Categorías"
        description="Explora componentes por categoría y encuentra exactamente lo que necesitas."
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {categories.map((category, index) => (
          <CategoryCard key={category.id} category={category} index={index} />
        ))}
      </div>
    </section>
  );
}
