import type { PublicProfile, QuoteSummary } from "@framerate/contracts";
import { IconCalendar, IconCpu, IconPencil, IconShare3 } from "@tabler/icons-react";
import { Link } from "react-router";
import { CreateQuoteDialog } from "~/features/quote/components/create-quote-dialog";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { buttonVariants } from "~/shared/components/primitives/button";
import { cn } from "~/shared/lib/utils";

const joined = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", { month: "long", year: "numeric", timeZone: "America/Santiago" });
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Santiago",
  });

const VISIBILITY_LABEL = { private: "Privada", unlisted: "Con enlace", public: null } as const;

/**
 * /perfil y /u/:username sin portada (GitHub, Letterboxd): sin degradados inventados ni separadores.
 * `cabecera`: identidad en una fila arriba y las cotizaciones debajo. `lateral`: identidad en una columna fija a la
 * izquierda (GitHub) y las cotizaciones a la derecha. Las cotizaciones son filas con texto, porque no tienen imagen.
 */
export function ProfileView({
  profile,
  isOwner,
  quotes = [],
  layout = "cabecera",
}: {
  profile: PublicProfile;
  isOwner: boolean;
  quotes?: QuoteSummary[];
  layout?: "cabecera" | "lateral";
}) {
  const name = profile.displayName || profile.username;
  const actions = (
    <>
      <button type="button" className={buttonVariants({ variant: "secondary" })}>
        <IconShare3 className="size-4" />
        Compartir
      </button>
      {isOwner && (
        <Link to="/ajustes/cuenta" className={buttonVariants({ variant: "secondary" })}>
          <IconPencil className="size-4" />
          Editar perfil
        </Link>
      )}
    </>
  );
  const details = (
    <>
      <div className="min-w-0">
        <h1 className="truncate font-semibold text-2xl text-foreground tracking-tight sm:text-3xl">{name}</h1>
        <p className="text-muted-foreground">@{profile.username}</p>
      </div>
      {profile.bio && (
        <p className="max-w-xl whitespace-pre-line text-foreground/85 text-sm leading-relaxed">{profile.bio}</p>
      )}
      <p className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
        <IconCalendar className="size-3.5" stroke={1.75} />
        En Framerate desde {joined(profile.createdAt)}
      </p>
    </>
  );
  const list = <QuoteList quotes={quotes} name={name} isOwner={isOwner} />;

  if (layout === "lateral") {
    return (
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-8 md:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4 md:sticky md:top-24 md:self-start">
          <Avatar src={profile.avatarUrl} name={name} className="size-24 md:size-32" />
          <div className="space-y-3">{details}</div>
          <div className="flex flex-wrap gap-2 md:flex-col md:[&>*]:justify-center">{actions}</div>
        </aside>
        {list}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          <Avatar src={profile.avatarUrl} name={name} className="size-20 sm:size-24" />
          <div className="min-w-0 space-y-2 pt-1">{details}</div>
        </div>
        <div className="flex shrink-0 gap-2">{actions}</div>
      </header>
      <div className="border-border border-t pt-8">{list}</div>
    </div>
  );
}

function QuoteList({ quotes, name, isOwner }: { quotes: QuoteSummary[]; name: string; isOwner: boolean }) {
  return (
    <section className="min-w-0 space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-foreground text-xl">{isOwner ? "Tus cotizaciones" : "Cotizaciones"}</h2>
          <p className="text-muted-foreground text-sm">
            {isOwner ? "Las públicas aparecen aquí para quien visite tu perfil." : `Las que ${name} hizo públicas.`}
          </p>
        </div>
        {isOwner && quotes.length > 0 && <CreateQuoteDialog />}
      </div>

      {quotes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-border bg-card px-6 py-12 text-center">
          <IconCpu className="size-6 text-muted-foreground" stroke={1.5} />
          <p className="font-medium text-foreground">
            {isOwner ? "Todavía no tienes cotizaciones" : `${name} todavía no publica cotizaciones`}
          </p>
          {isOwner && (
            <>
              <p className="max-w-sm text-muted-foreground text-sm">
                Arma un PC con precios de varias tiendas y compártelo con un enlace.
              </p>
              <CreateQuoteDialog />
            </>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {quotes.map((quote) => (
            <li key={quote.id}>
              <QuoteItemRow quote={quote} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QuoteItemRow({ quote }: { quote: QuoteSummary }) {
  const visibility = VISIBILITY_LABEL[quote.visibility];
  return (
    <Link
      to={`/cotizacion/${quote.id}`}
      className="group block space-y-2 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <h3 className="truncate font-semibold text-base text-foreground tracking-tight">{quote.name}</h3>
      {quote.description && <p className="line-clamp-2 text-muted-foreground text-sm">{quote.description}</p>}
      <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
        <Chip>{quote.itemCount === 1 ? "1 componente" : `${quote.itemCount} componentes`}</Chip>
        <Chip>{shortDate(quote.updatedAt)}</Chip>
        {visibility && <Chip>{visibility}</Chip>}
      </div>
    </Link>
  );
}

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-md bg-secondary px-2 py-0.5">{children}</span>
);

/** Foto del proveedor de inicio de sesión o la inicial sobre la superficie del sistema (sin colores inventados). */
function Avatar({ src, name, className }: { src: string | null; name: string; className?: string }) {
  const initial = (
    <span className="flex size-full items-center justify-center font-semibold text-2xl text-muted-foreground">
      {name.charAt(0).toUpperCase()}
    </span>
  );
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-full bg-secondary", className)}>
      {src ? (
        <AsyncImage src={src} alt={name} className="absolute inset-0 size-full object-cover" errorFallback={initial} />
      ) : (
        initial
      )}
    </div>
  );
}
