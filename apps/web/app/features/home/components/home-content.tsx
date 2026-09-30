import type { HomeData } from "../types";
import { CategoryLinks } from "./category-links";
import { CompactSearchHero } from "./compact-search-hero";
import { CategoryMosaic, StoresStrip, ValueProps } from "./home-blocks";
import { ProductRow } from "./product-row";

/** Home: buscador, promesa de valor, lo más popular, categorías, tiendas y una fila por categoría. */
export function HomeContent({ categories, rows, trendingIds, stores }: HomeData) {
  const trending = new Set(trendingIds);
  const [popular, ...byCategory] = rows;
  return (
    <>
      <CompactSearchHero categories={categories} />
      <div className="flex flex-col gap-10 pb-16 md:gap-12">
        <ValueProps storeCount={stores.length} />
        {popular && <ProductRow title={popular.title} href={popular.href} products={popular.products} priority />}
        <CategoryMosaic categories={categories} />
        <StoresStrip stores={stores} />
        {byCategory.map((row) => (
          <ProductRow key={row.key} title={row.title} href={row.href} products={row.products} trendingIds={trending} />
        ))}
        <CategoryLinks categories={categories} />
      </div>
    </>
  );
}
