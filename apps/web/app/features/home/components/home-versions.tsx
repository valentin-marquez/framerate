import { Link, useSearchParams } from "react-router";
import { ProductCardCompact } from "~/features/product/components/card-product-compact";
import type { Product } from "~/features/product/services/products";
import { getProductPricing } from "~/features/product/utils/pricing";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { getImageUrl } from "~/shared/utils/images";
import type { HomeData } from "../types";
import { CategoryLinks } from "./category-links";
import { CompactSearchHero } from "./compact-search-hero";
import {
  CategoryCircles,
  CategoryGrid,
  CategoryMosaic,
  StatsRow,
  StoresStrip,
  TrustBlock,
  ValueProps,
} from "./home-blocks";
import { ProductRow } from "./product-row";

/**
 * Tres composiciones de la home para revisar (`/?v=1|2|3`). Comparten datos y componentes; cambia el orden, la
 * jerarquía y la densidad. Cuando se elija una, se borran las otras y este selector.
 */

const productCount = (data: HomeData) => data.categories.reduce((n, c) => n + (c.product_count ?? 0), 0);

function Rows({ rows, trendingIds, from = 0 }: { rows: HomeData["rows"]; trendingIds: Set<string>; from?: number }) {
  return rows.map((row, i) => (
    <ProductRow
      key={row.key}
      title={row.title}
      href={row.href}
      products={row.products}
      priority={from + i === 0}
      trendingIds={row.key === "popular" ? undefined : trendingIds}
    />
  ));
}

/** Título breve para v2 y v3, con el ancla donde se posa el buscador flotante. */
function SlimHero({ children }: { children?: React.ReactNode }) {
  return (
    <section className="flex flex-col items-center gap-4 pt-6 pb-6 md:pt-10">
      <h1 className="text-center font-semibold text-2xl text-foreground tracking-tight md:text-3xl">
        Encuentra tu hardware al <span className="text-primary">mejor precio</span>
      </h1>
      <div id="hero-search-anchor" aria-hidden className="h-14 w-full max-w-2xl" />
      {children}
    </section>
  );
}

const Page = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("flex flex-col gap-10 pb-16 md:gap-12", className)}>{children}</div>
);

/** v1 · Búsqueda + promesa de valor + mosaico de categorías (SoloTodo). Es la home actual, ordenada y con más señales de confianza. */
export function HomeV1(data: HomeData) {
  const trending = new Set(data.trendingIds);
  const [popular, ...byCategory] = data.rows;
  return (
    <>
      <CompactSearchHero categories={data.categories} />
      <Page>
        <ValueProps storeCount={data.stores.length} />
        {popular && <Rows rows={[popular]} trendingIds={trending} />}
        <CategoryMosaic categories={data.categories} rows={data.rows} />
        <StoresStrip stores={data.stores} />
        <Rows rows={byCategory} trendingIds={trending} from={1} />
        <CategoryLinks categories={data.categories} />
      </Page>
    </>
  );
}

/** v2 · Categorías primero y catálogo denso, sin carruseles arriba (PriceSpy + PC Factory). */
export function HomeV2(data: HomeData) {
  const trending = new Set(data.trendingIds);
  const popular = data.rows.find((r) => r.key === "popular");
  const byCategory = data.rows.filter((r) => r.key !== "popular");
  return (
    <>
      <SlimHero />
      <Page>
        <CategoryGrid categories={data.categories} rows={data.rows} />
        {popular && (
          <section className="space-y-3">
            <div className="flex items-end justify-between">
              <h2 className="font-semibold text-foreground text-lg tracking-tight md:text-xl">Lo más popular</h2>
              <Link to={popular.href} prefetch="intent" className="text-muted-foreground text-sm hover:text-primary">
                Ver todos
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {popular.products.slice(0, 12).map((product, i) => (
                <ProductCardCompact key={product.id} product={product} priority={i < 6} className="h-full" />
              ))}
            </div>
          </section>
        )}
        <Rows rows={byCategory} trendingIds={trending} from={1} />
        <StoresStrip stores={data.stores} />
      </Page>
    </>
  );
}

function Featured({ product }: { product: Product }) {
  const { current } = getProductPricing(product.prices);
  return (
    <Link
      to={`/producto/${product.slug}`}
      prefetch="intent"
      className="group flex h-full flex-col justify-between gap-4 rounded-2xl border border-border/40 bg-background p-5 transition-colors hover:border-primary/40"
    >
      <p className="font-medium text-primary text-xs uppercase tracking-wide">Lo más visto</p>
      {product.image_url && (
        <img
          src={getImageUrl(product.image_url)}
          alt={product.name ?? ""}
          fetchPriority="high"
          className="mx-auto h-40 w-full object-contain"
        />
      )}
      <div className="space-y-1">
        <p className="line-clamp-2 font-medium text-foreground text-sm">{product.name}</p>
        <p className="flex items-center justify-between">
          <span className="font-semibold text-foreground text-xl">{formatCLP(current ?? 0)}</span>
          <span className="text-muted-foreground text-xs group-hover:text-primary">Ver ofertas</span>
        </p>
      </div>
    </Link>
  );
}

/** v3 · Tablero: portada dividida con el producto más visto, categorías en círculos y banda destacada (idealo). */
export function HomeV3(data: HomeData) {
  const trending = new Set(data.trendingIds);
  const popular = data.rows.find((r) => r.key === "popular");
  const byCategory = data.rows.filter((r) => r.key !== "popular");
  const featured = popular?.products[0];
  return (
    <Page className="pt-6 md:pt-10">
      <section className="grid gap-6 rounded-3xl border border-border/40 bg-card p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
        <div className="flex flex-col justify-center gap-5">
          <h1 className="font-semibold text-3xl text-foreground tracking-tight md:text-4xl">
            Encuentra tu hardware al <span className="text-primary">mejor precio</span>
          </h1>
          <p className="max-w-md text-muted-foreground">
            Compara precios de las tiendas de Chile, revisa el historial y arma tu cotización.
          </p>
          <div id="hero-search-anchor" aria-hidden className="h-14 w-full max-w-xl" />
          <StatsRow productCount={productCount(data)} storeCount={data.stores.length} />
        </div>
        {featured && <Featured product={featured} />}
      </section>

      <CategoryCircles categories={data.categories} rows={data.rows} />

      {popular && (
        <div className="-mx-4 rounded-3xl bg-primary/5 px-4 py-6 md:mx-0 md:px-6">
          <Rows rows={[popular]} trendingIds={trending} />
        </div>
      )}
      <Rows rows={byCategory} trendingIds={trending} from={1} />
      <StoresStrip stores={data.stores} />
      <TrustBlock />
    </Page>
  );
}

const VERSIONS = { "1": HomeV1, "2": HomeV2, "3": HomeV3 } as const;
type Version = keyof typeof VERSIONS;

export function isVersion(v: string | null): v is Version {
  return v !== null && v in VERSIONS;
}

/** Selector flotante temporal para comparar propuestas. */
export function VersionSwitcher({ current }: { current: string }) {
  const [params] = useSearchParams();
  const link = (v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set("v", v);
    else next.delete("v");
    return `?${next.toString()}`;
  };
  return (
    <nav
      aria-label="Versión de la home"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border/60 bg-card/80 p-1 shadow-lg backdrop-blur-md"
    >
      {[
        [null, "Actual"],
        ["1", "v1"],
        ["2", "v2"],
        ["3", "v3"],
      ].map(([v, label]) => (
        <Link
          key={label}
          to={link(v)}
          replace
          preventScrollReset
          className={cn(
            "rounded-full px-3.5 py-1.5 font-medium text-sm transition-colors",
            (v ?? "") === current
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function HomeVersion({ version, data }: { version: Version; data: HomeData }) {
  const Component = VERSIONS[version];
  return <Component {...data} />;
}
