import type { HomeData } from "../types";
import { CategoryLinks } from "./category-links";
import { CategoryMosaic, StoresStrip } from "./home-blocks";
import { HomeIntro } from "./home-intro";
import { ProductRow } from "./product-row";

/** Home: encabezado con cifras, lo más popular, categorías, tiendas y una fila por categoría. */
export function HomeContent({ categories, rows, trendingIds, stores }: HomeData) {
  const trending = new Set(trendingIds);
  const [popular, ...byCategory] = rows;
  return (
    <>
      <HomeIntro productCount={categories.reduce((sum, c) => sum + c.productCount, 0)} storeCount={stores.length} />
      <div className="flex flex-col gap-10 pb-16 md:gap-12">
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
