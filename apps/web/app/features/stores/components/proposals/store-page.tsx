import type { StoreDetail } from "@framerate/contracts";
import { IconCircleCheckFilled, IconExternalLink, IconShieldCheck, IconSparkles } from "@tabler/icons-react";
import { Link } from "react-router";
import { ProductRow } from "~/features/home/components/product-row";
import { RatingStars } from "~/features/store-reviews/components/rating-stars";
import { StoreReviewsSection } from "~/features/store-reviews/components/store-reviews-section";
import { OutboundLink } from "~/shared/components/outbound-link";
import { buttonVariants } from "~/shared/components/primitives/button";
import { StoreLogo } from "~/shared/components/store-logo";
import type { StoreProductCategory } from "../../services/stores";

const since = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", { month: "long", year: "numeric", timeZone: "America/Santiago" });
const decimal = (n: number) => n.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("es-CL")} ${n === 1 ? one : many}`;

interface StorePageProps {
  store: StoreDetail;
  categories: StoreProductCategory[];
  /** Rol de quien mira, si administra la tienda. */
  viewerRole: "owner" | "admin" | "editor" | null;
}

/**
 * /tiendas/:slug en el sistema nuevo (Trustpilot, Geizhals, idealo): cabecera de identidad con la nota a la derecha,
 * sin el banner de stock cuando la tienda no subió uno, y las secciones de productos y reseñas que ya existen.
 */
export function StorePage({ store, categories, viewerRole }: StorePageProps) {
  const host = store.website ? new URL(store.website).hostname.replace(/^www\./, "") : null;
  const { rating } = store;
  const total = categories.reduce((n, c) => n + c.count, 0);

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      {store.bannerUrl && <img src={store.bannerUrl} alt="" className="h-36 w-full rounded-3xl object-cover sm:h-48" />}

      <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          <StoreLogo
            store={{ name: store.name, slug: store.slug, icon_url: store.iconUrl }}
            className="size-16 rounded-2xl sm:size-20"
          />
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-semibold text-3xl text-foreground tracking-tight">{store.name}</h1>
              {store.verifiedAt && (
                <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 font-medium text-foreground text-xs">
                  <IconCircleCheckFilled className="size-3.5 text-success" />
                  Verificada
                </span>
              )}
            </div>
            {store.description && (
              <p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">{store.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-sm">
              {host && (
                <OutboundLink
                  href={store.website ?? store.url}
                  source="store_page"
                  storeId={store.slug}
                  className={buttonVariants({ size: "sm" })}
                >
                  Ir a {host}
                  <IconExternalLink className="size-3.5" />
                </OutboundLink>
              )}
              {store.offerCount > 0 && (
                <span className="text-muted-foreground">{plural(store.offerCount, "producto", "productos")}</span>
              )}
              <span className="text-muted-foreground">En Framerate desde {since(store.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Sin reseñas no hay nada que resumir: la sección de abajo ya invita a dejar la primera. */}
        {rating.average !== null && rating.count > 0 && (
          <a
            href="#resenas"
            className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4 transition-colors hover:border-foreground/15"
          >
            <span className="font-semibold text-4xl text-foreground tabular-nums tracking-tight">
              {decimal(rating.average)}
            </span>
            <span className="space-y-1">
              <RatingStars value={rating.average} size="sm" />
              <span className="block text-muted-foreground text-xs">
                {plural(rating.count, "reseña", "reseñas")}
                {rating.recent.count > 0 && rating.recent.average !== null && (
                  <span className="block">
                    Últimos 30 días: {decimal(rating.recent.average)} ({rating.recent.count})
                  </span>
                )}
              </span>
            </span>
          </a>
        )}
      </header>

      {viewerRole ? (
        <Notice icon={<IconShieldCheck className="size-5" />} text="Administras esta tienda.">
          <Link to={`/tiendas/${store.slug}/admin`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Panel de la tienda
          </Link>
        </Notice>
      ) : (
        !store.isClaimed && (
          <Notice
            icon={<IconSparkles className="size-5" />}
            text="¿Es tu tienda? Verifica el dominio y podrás editar este perfil y responder reseñas."
          >
            <Link to={`/reclamar?store=${store.slug}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Reclamar tienda
            </Link>
          </Notice>
        )
      )}

      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="font-semibold text-foreground text-xl tracking-tight">Productos</h2>
          <p className="text-muted-foreground text-sm">
            {categories.length > 0
              ? `${plural(total, "producto", "productos")} en ${plural(categories.length, "categoría", "categorías")}. El precio de cada tarjeta es el mejor entre todas las tiendas.`
              : "Todavía no registramos productos de esta tienda en el catálogo."}
          </p>
        </div>
        {categories.map((c, i) => (
          <ProductRow
            key={c.slug}
            title={c.name}
            href={`/categoria/${c.slug}`}
            products={c.products}
            priority={i === 0}
          />
        ))}
      </section>

      {/* La sección de reseñas ya trae su resumen y su título. */}
      <section id="resenas" className="scroll-mt-24">
        <StoreReviewsSection storeSlug={store.slug} canManage={viewerRole !== null} />
      </section>
    </main>
  );
}

function Notice({ icon, text, children }: { icon: React.ReactNode; text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="flex items-center gap-3 text-foreground text-sm">
        <span className="text-muted-foreground">{icon}</span>
        {text}
      </p>
      {children}
    </div>
  );
}
