import type { StoreDetail } from "@framerate/contracts";
import { IconCircleCheckFilled, IconExternalLink, IconShieldCheck, IconSparkles } from "@tabler/icons-react";
import { Link } from "react-router";
import { LoginDialog } from "~/features/auth/components/login-dialog";
import { ProductRow } from "~/features/home/components/product-row";
import { RatingStars } from "~/features/store-reviews/components/rating-stars";
import { StoreReviewsSection } from "~/features/store-reviews/components/store-reviews-section";
import { OutboundLink } from "~/shared/components/outbound-link";
import { buttonVariants } from "~/shared/components/primitives/button";
import { StoreLogo } from "~/shared/components/store-logo";
import type { StoreProductCategory } from "../services/stores";

const since = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", { month: "long", year: "numeric", timeZone: "America/Santiago" });
const decimal = (n: number) => n.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("es-CL")} ${n === 1 ? one : many}`;

interface StoreViewProps {
  store: StoreDetail;
  categories: StoreProductCategory[];
  /** Rol de quien mira, si administra la tienda. */
  viewerRole: "owner" | "admin" | "editor" | null;
  /** Sin sesión, verificar la tienda pide iniciarla y vuelve al asistente. */
  isAuthenticated: boolean;
}

/**
 * /tiendas/:slug (Trustpilot, Geizhals, idealo): cabecera de identidad con la nota a la derecha,
 * sin el banner de stock cuando la tienda no subió uno, las filas de productos por categoría y las reseñas.
 */
export function StoreView({ store, categories, viewerRole, isAuthenticated }: StoreViewProps) {
  const host = store.website ? new URL(store.website).hostname.replace(/^www\./, "") : null;
  const { rating } = store;
  const claimHref = `/reclamar?store=${store.slug}`;

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      {store.bannerUrl && <img src={store.bannerUrl} alt="" className="h-36 w-full rounded-3xl object-cover sm:h-48" />}

      <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="flex min-w-0 flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:gap-5 sm:text-left">
          <StoreLogo
            store={{ name: store.name, slug: store.slug, icon_url: store.iconUrl }}
            className="size-16 rounded-2xl sm:size-20"
          />
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-title-h4 text-foreground">{store.name}</h1>
              {store.verifiedAt && (
                <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 font-medium text-foreground text-xs">
                  <IconCircleCheckFilled className="size-3.5 text-success" />
                  Verificada
                </span>
              )}
            </div>
            {store.description && (
              <p className="mx-auto max-w-2xl text-muted-foreground text-sm leading-relaxed sm:mx-0">
                {store.description}
              </p>
            )}
            <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-muted-foreground text-sm sm:justify-start">
              {store.offerCount > 0 && <span>{plural(store.offerCount, "producto", "productos")}</span>}
              <span>En Framerate desde {since(store.createdAt)}</span>
            </p>
            {host && (
              <div className="flex justify-center pt-1 sm:justify-start">
                <OutboundLink
                  href={store.website ?? store.url}
                  source="store_page"
                  storeId={store.slug}
                  className={buttonVariants({ size: "sm" })}
                >
                  Ir a {host}
                  <IconExternalLink className="size-3.5" />
                </OutboundLink>
              </div>
            )}
          </div>
        </div>

        {/* Sin reseñas no hay nada que resumir: la sección de abajo ya invita a dejar la primera. */}
        {rating.average !== null && rating.count > 0 && (
          <a
            href="#resenas"
            className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4 transition-colors hover:border-foreground/15"
          >
            <span className="text-title-h3 text-foreground tabular-nums">{decimal(rating.average)}</span>
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
        <Notice icon={<IconShieldCheck className="size-5" />} text={`Administras esta tienda como ${viewerRole}.`}>
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
            {isAuthenticated ? (
              <Link to={claimHref} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Verificar mi tienda
              </Link>
            ) : (
              <LoginDialog
                returnTo={claimHref}
                title="Inicia sesión para verificar tu tienda"
                description="Necesitas una cuenta para verificar la propiedad y gestionar la tienda después."
                trigger={
                  <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                    Verificar mi tienda
                  </button>
                }
              />
            )}
          </Notice>
        )
      )}

      {categories.length > 0 ? (
        <section className="space-y-6">
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
      ) : (
        <p className="rounded-3xl border border-border border-dashed px-6 py-10 text-center text-muted-foreground text-sm">
          Todavía no registramos productos de esta tienda en el catálogo.
        </p>
      )}

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
