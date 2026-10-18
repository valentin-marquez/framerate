import type { HomeData } from "../types";
import { StoresStrip } from "./home-blocks";
import { HomeIntro } from "./home-intro";
import { ProductRow } from "./product-row";

/** Home: encabezado con cifras, lo más popular, bajas de precio, tiendas y una fila por categoría (las categorías viven en el riel). */
export function HomeContent({ categories, rows, drops, trendingIds, stores }: HomeData) {
  const trending = new Set(trendingIds);
  const [popular, ...byCategory] = rows;
  return (
    <>
      <HomeIntro productCount={categories.reduce((sum, c) => sum + c.productCount, 0)} storeCount={stores.length} />
      <div className="flex flex-col gap-10 pb-16 md:gap-12">
        {popular && <ProductRow title={popular.title} href={popular.href} products={popular.products} priority />}
        <ProductRow title="Bajadas de precio" href="/buscar?sort=discount" more="Ver todas" products={drops} priority />
        <StoresStrip stores={stores} />
        {byCategory.map((row) => (
          <ProductRow key={row.key} title={row.title} href={row.href} products={row.products} trendingIds={trending} />
        ))}
      </div>
    </>
  );
}
