import { QUOTES_MAX_PAGE_SIZE, type QuoteSummary } from "@framerate/contracts";
import { IconAlertCircle } from "@tabler/icons-react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { getAuthUser, requireAuth } from "~/features/auth/services/auth.server";
import { ProfileView } from "~/features/profile/components/profile-view";
import { meToProfile, profilesService } from "~/features/profile/services/profiles";
import { quotesService } from "~/features/quote/services/quotes";
import { Button } from "~/shared/components/primitives/button";
import { useTranslation } from "~/shared/hooks/use-translation";
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

/** Un fallo al listar cotizaciones no tumba el perfil: se muestra sin ellas. */
const quotesOrEmpty = (load: Promise<{ items: QuoteSummary[] }>) =>
  load
    .then((page) => page.items)
    .catch((error): QuoteSummary[] => {
      console.error("No se pudieron listar las cotizaciones", error);
      return [];
    });

export async function loader({ request, params }: Route.LoaderArgs) {
  const { username } = params;

  if (username) {
    try {
      const [{ user: currentUser }, profileUser, publicQuotes] = await Promise.all([
        getAuthUser(request),
        profilesService.getByUsername(username),
        quotesOrEmpty(quotesService.getByUsername(username, 1, QUOTES_MAX_PAGE_SIZE)),
      ]);
      const isOwner = currentUser?.username === profileUser.username;
      // El dueño ve también las privadas y las con link, no sólo las públicas.
      const quotes = isOwner ? await quotesOrEmpty(quotesService.getAll(1, QUOTES_MAX_PAGE_SIZE)) : publicQuotes;
      return { profileUser, quotes, isOwner, currentUser };
    } catch (_error) {
      throw new Response("User not found", { status: 404 });
    }
  }

  const [{ user }, quotes] = await Promise.all([
    requireAuth(request),
    quotesOrEmpty(quotesService.getAll(1, QUOTES_MAX_PAGE_SIZE)),
  ]);
  return { profileUser: meToProfile(user), quotes, isOwner: true, currentUser: user };
}

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { profileUser, isOwner, quotes } = loaderData;
  const { t } = useTranslation();

  return (
    <ProfileView
      profile={{
        username: profileUser.username ?? "",
        displayName: profileUser.full_name || profileUser.username || t("profile_default_name"),
        avatarUrl: profileUser.avatar_url,
        bio: profileUser.bio,
        createdAt: profileUser.created_at,
      }}
      isOwner={isOwner}
      quotes={quotes}
    />
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
      <h1 className="text-2xl font-semibold tracking-tight mb-2">{message}</h1>
      <p className="text-muted-foreground mb-8">{details}</p>
      <Button nativeButton={false} render={<Link to="/" />}>
        {t("profile_back_home")}
      </Button>
    </div>
  );
}
