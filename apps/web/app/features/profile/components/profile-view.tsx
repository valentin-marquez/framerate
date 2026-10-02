import type { PublicProfile, QuoteSummary } from "@framerate/contracts";
import { IconCalendar, IconCpu, IconPencil, IconShare3 } from "@tabler/icons-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { CreateQuoteDialog } from "~/features/quote/components/create-quote-dialog";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { Button } from "~/shared/components/primitives/button";
import { useTranslation } from "~/shared/hooks/use-translation";

/** /perfil y /u/:username: identidad en una fila y debajo las cotizaciones como filas de texto (no tienen imagen). */
export function ProfileView({
  profile,
  isOwner,
  quotes,
}: {
  profile: PublicProfile;
  isOwner: boolean;
  quotes: QuoteSummary[];
}) {
  const { t, lang } = useTranslation();
  const locale = lang === "en" ? "en-US" : "es-CL";
  // timeZone explícito: el servidor (Workers) y el cliente pueden estar en zonas distintas y la hidratación fallaría.
  const date = (iso: string, options: Intl.DateTimeFormatOptions) =>
    new Date(iso).toLocaleDateString(locale, { ...options, timeZone: "America/Santiago" });
  const name = profile.displayName || profile.username;

  const share = async () => {
    const url = `${window.location.origin}/u/${profile.username}`;
    try {
      if (navigator.share) await navigator.share({ title: name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(t("profile_share_copied"));
      }
    } catch {
      // quien cierra el diálogo de compartir no es un error
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          <Avatar src={profile.avatarUrl} name={name} />
          <div className="min-w-0 space-y-3 sm:space-y-2 sm:pt-1">
            <div>
              <h1 className="truncate font-semibold text-2xl text-foreground tracking-tight sm:text-3xl">{name}</h1>
              <p className="text-muted-foreground">@{profile.username}</p>
            </div>
            {profile.bio && (
              <p className="max-w-xl whitespace-pre-line text-foreground/85 text-sm leading-relaxed">{profile.bio}</p>
            )}
            <p className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
              <IconCalendar className="size-3.5" stroke={1.75} />
              {t("profile_joined", { date: date(profile.createdAt, { month: "long", year: "numeric" }) })}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" onClick={share}>
            <IconShare3 className="size-4" />
            {t("profile_share")}
          </Button>
          {isOwner && (
            <Button variant="secondary" nativeButton={false} render={<Link to="/ajustes/cuenta" />}>
              <IconPencil className="size-4" />
              {t("profile_edit")}
            </Button>
          )}
        </div>
      </header>

      <section className="min-w-0 space-y-4 border-border border-t pt-8">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h2 className="font-semibold text-foreground text-xl">
            {t(isOwner ? "profile_quotes_title_owner" : "profile_quotes_title_other", { name })}
          </h2>
          {isOwner && quotes.length > 0 && <CreateQuoteDialog />}
        </div>

        {quotes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-border bg-card px-6 py-12 text-center">
            <IconCpu className="size-6 text-muted-foreground" stroke={1.5} />
            <p className="font-medium text-foreground">
              {t(isOwner ? "profile_no_quotes_owner" : "profile_no_quotes_other")}
            </p>
            {isOwner && (
              <>
                <p className="mb-2 max-w-sm text-muted-foreground text-sm">{t("profile_no_quotes_owner_cta")}</p>
                <CreateQuoteDialog />
              </>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {quotes.map((quote) => (
              <li key={quote.id}>
                <Link
                  to={`/cotizacion/${quote.id}`}
                  className="block space-y-2 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <h3 className="truncate font-semibold text-base text-foreground tracking-tight">{quote.name}</h3>
                  {quote.description && (
                    <p className="line-clamp-2 text-muted-foreground text-sm">{quote.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
                    <Chip>
                      {t(quote.itemCount === 1 ? "quote_components_one" : "profile_components_count", {
                        count: quote.itemCount,
                      })}
                    </Chip>
                    <Chip>{date(quote.updatedAt, { day: "numeric", month: "short", year: "numeric" })}</Chip>
                    {quote.visibility !== "public" && <Chip>{t(`quote_visibility_${quote.visibility}`)}</Chip>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-md bg-secondary px-2 py-0.5">{children}</span>
);

/** Foto del proveedor de inicio de sesión o la inicial sobre la superficie del sistema (sin colores inventados). */
function Avatar({ src, name }: { src: string | null; name: string }) {
  const initial = (
    <span className="flex size-full items-center justify-center font-semibold text-2xl text-muted-foreground">
      {name.charAt(0).toUpperCase()}
    </span>
  );
  return (
    <div className="relative size-20 shrink-0 overflow-hidden rounded-full bg-secondary sm:size-24">
      {src ? (
        <AsyncImage src={src} alt={name} className="absolute inset-0 size-full object-cover" errorFallback={initial} />
      ) : (
        initial
      )}
    </div>
  );
}
