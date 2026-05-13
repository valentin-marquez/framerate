import {
  IconAlertCircle,
  IconCalendarFilled,
  IconChevronRight,
  IconCpu,
  IconPencil,
  IconShare3,
} from "@tabler/icons-react";
import { isRouteErrorResponse, Link, redirect, useRouteError } from "react-router";
import { toast } from "sonner";
import { getAuthUser, requireAuth } from "~/features/auth/services/auth.server";
import { profilesService } from "~/features/profile/services/profiles";
import { CreateQuoteDialog } from "~/features/quote/components/create-quote-dialog";
import { useQuotes } from "~/features/quote/hooks/useQuotes";
import { quotesService } from "~/features/quote/services/quotes";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { Button } from "~/shared/components/primitives/button";
import { Separator } from "~/shared/components/primitives/separator";
import { useTranslation } from "~/shared/hooks/use-translation";
import { getGradient } from "~/shared/utils/gradients";
import type { Route } from "./+types/profile-page";

export function meta({ data }: Route.MetaArgs) {
  if (!data || !data.profileUser) {
    return [{ title: "Perfil no encontrado - Framerate" }];
  }
  const { profileUser } = data;
  const displayName = profileUser.full_name || profileUser.username || "Usuario";
  const title = `Perfil de ${displayName} - Framerate`;
  const description =
    profileUser.bio ?? `Mira las cotizaciones y configuraciones de PC de ${displayName} en Framerate.cl.`;

  return [
    { title },
    { name: "description", content: description },
    { property: "og:site_name", content: "Framerate.cl" },
    { property: "og:locale", content: "es_CL" },
    { property: "og:type", content: "profile" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: profileUser.avatar_url || "/og-image.png" },
    { name: "twitter:card", content: "summary" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { username } = params;

  if (username) {
    const { user: currentUser, supabase } = await getAuthUser(request);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    try {
      const response = await quotesService.getByUsername(username, 1, 100, session?.access_token);
      const isOwner = currentUser?.id === response.user.id;

      return {
        profileUser: response.user,
        quotes: response.data,
        isOwner,
        currentUser,
      };
    } catch (_error) {
      throw new Response("User not found", { status: 404 });
    }
  }

  const { user, supabase } = await requireAuth(request);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw redirect("/");
  }

  try {
    const [profile, quotes] = await Promise.all([
      profilesService.getMe(session.access_token),
      quotesService.getAll(1, 100, session.access_token),
    ]);

    return {
      profileUser: profile,
      quotes: quotes.data,
      isOwner: true,
      currentUser: user,
    };
  } catch (error) {
    console.error("Error loading profile data:", error);
    throw new Response("Error loading profile", { status: 500 });
  }
}

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { profileUser, isOwner } = loaderData;
  const { t, lang } = useTranslation();

  const { data: quotesData } = useQuotes(1, 100);
  const quotes = (isOwner && quotesData?.data) || loaderData.quotes;

  const locale = lang === "en" ? "en-US" : "es-CL";
  const joinDate = profileUser?.created_at
    ? new Date(profileUser.created_at).toLocaleDateString(locale, { month: "long", year: "numeric" })
    : "—";

  const displayName = profileUser.full_name || profileUser.username || t("profile_default_name");
  const initial = displayName.charAt(0).toUpperCase();
  const bannerGradient = getGradient(profileUser.id ?? displayName);

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = profileUser.username ? `${window.location.origin}/u/${profileUser.username}` : window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: displayName, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success(t("profile_share_copied"));
      }
    } catch {
      // user dismissed share sheet — silent
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Page-level ambient blur, anchored at the bottom so it doesn't fight
          the navbar gradient at the top. Sits behind everything. */}
      {profileUser.avatar_url ? (
        <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[35vh] overflow-hidden">
          <img
            src={profileUser.avatar_url}
            alt=""
            className="absolute inset-0 size-full object-cover scale-[1.8] blur-[120px] saturate-200 opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-background/50 to-background" />
        </div>
      ) : (
        <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[35vh] overflow-hidden">
          <div
            className="absolute inset-0 opacity-35 blur-[120px] scale-[1.8]"
            style={{ background: bannerGradient }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-background/50 to-background" />
        </div>
      )}

      {/* Profile header card — plain bg-card, avatar overflows above */}
      <div className="relative pt-10 sm:pt-12">
        <div className="absolute top-2 sm:top-4 left-5 sm:left-8 z-10">
          <div className="relative size-24 sm:h-28 sm:w-28 rounded-2xl ring-4 ring-background bg-card shadow-xl overflow-hidden">
            {profileUser.avatar_url ? (
              <AsyncImage
                src={profileUser.avatar_url}
                alt={displayName}
                className="absolute inset-0 size-full object-cover"
                fallback={
                  <div className="size-full flex items-center justify-center bg-secondary text-3xl font-semibold text-muted-foreground">
                    {initial}
                  </div>
                }
              />
            ) : (
              <div
                className="size-full flex items-center justify-center text-3xl font-semibold text-white"
                style={{ background: bannerGradient }}
              >
                {initial}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card pt-20 sm:pt-24 px-5 sm:px-8 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{displayName}</h1>
              {profileUser.username && <p className="text-sm text-muted-foreground">@{profileUser.username}</p>}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button variant="secondary" size="sm" className="gap-1.5" onClick={handleShare}>
                <IconShare3 className="size-4" />
                <span className="hidden sm:inline">{t("profile_share")}</span>
              </Button>
              {isOwner && (
                <Button variant="secondary" size="sm" className="gap-1.5" render={<Link to="/settings/account" />}>
                  <IconPencil className="size-4" />
                  <span className="hidden sm:inline">{t("profile_edit")}</span>
                </Button>
              )}
            </div>
          </div>

          {profileUser.bio && (
            <p className="mt-4 text-sm leading-relaxed text-foreground/85 max-w-2xl whitespace-pre-line">
              {profileUser.bio}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <IconCalendarFilled className="size-3.5" />
              {t("profile_joined", { date: joinDate })}
            </span>
            <span className="text-border">•</span>
            <span>
              {t(isOwner ? "profile_quotes_count_owner" : "profile_quotes_count_other", {
                count: quotes.length,
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">
            {t(isOwner ? "profile_quotes_title_owner" : "profile_quotes_title_other", { name: displayName })}
          </h2>
          {isOwner && quotes.length > 0 && <CreateQuoteDialog />}
        </div>

        <Separator className="border-1.5" />

        {quotes.length === 0 ? (
          <div className="text-center py-14 px-4 border border-dashed border-border/70 rounded-2xl bg-card/40">
            <div className="mx-auto size-12 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
              <IconCpu className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">
              {t(isOwner ? "profile_no_quotes_owner" : "profile_no_quotes_other")}
            </h3>
            {isOwner && (
              <>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto text-sm">
                  {t("profile_no_quotes_owner_cta")}
                </p>
                <CreateQuoteDialog />
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {quotes.map((quote, index) => {
              const isNewOptimistic = index === 0 && quote.id.startsWith("temp-");
              const dateLabel = new Date(quote.updated_at).toLocaleDateString(locale, {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const componentsCount = quote.quote_items?.[0]?.count || 0;

              const cardBody = (
                // biome-ignore lint/correctness/useJsxKeyInIterable: cardBody es hijo de elementos con key
                <div className="flex items-center p-2 gap-4">
                  <div className="size-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-xl">
                    <div
                      className="size-full transition-transform duration-500 group-hover:scale-110"
                      style={{ background: getGradient(quote.id) }}
                    />
                  </div>
                  <div className="flex-1 py-2 pr-4 flex items-center justify-between min-w-0">
                    <div className="space-y-1.5 min-w-0">
                      <h3 className="font-bold text-base sm:text-lg group-hover:text-primary transition-colors tracking-tight truncate">
                        {quote.name}
                      </h3>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                        <span className="capitalize">{dateLabel}</span>
                        <span className="hidden sm:inline text-border/60">•</span>
                        <span className="font-medium">{t("profile_components_count", { count: componentsCount })}</span>
                      </div>
                    </div>
                    <div className="text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300 pl-4 shrink-0">
                      <IconChevronRight className="size-5" />
                    </div>
                  </div>
                </div>
              );

              return isNewOptimistic ? (
                <div
                  key={quote.id}
                  className="group block overflow-hidden bg-card border border-primary/30 rounded-2xl shadow-md shadow-primary/10 quote-item-enter quote-item-glow"
                >
                  {cardBody}
                </div>
              ) : (
                <Link
                  key={quote.id}
                  to={`/cotizacion/${quote.id}`}
                  className="group block overflow-hidden bg-card hover:bg-secondary border border-border/60 hover:border-primary/30 transition-colors rounded-2xl"
                >
                  {cardBody}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const { t } = useTranslation();
  let message = t("profile_unexpected_error");
  let details = t("profile_try_again");

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      message = t("profile_not_found_title");
      details = t("profile_not_found_desc");
    } else if (error.status === 500) {
      message = t("profile_load_error_title");
      details = t("profile_load_error_desc");
    }
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-md text-center">
      <div className="mx-auto size-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
        <IconAlertCircle className="size-8 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">{message}</h1>
      <p className="text-muted-foreground mb-8">{details}</p>
      <Button render={<Link to="/" />}>{t("profile_back_home")}</Button>
    </div>
  );
}
