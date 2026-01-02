import { IconAlertCircle, IconCalendarFilled, IconChevronRight, IconCpu } from "@tabler/icons-react";
import { isRouteErrorResponse, Link, redirect, useRouteError } from "react-router";
import { Button } from "~/components/primitives/button";
import { Separator } from "~/components/primitives/separator";
import { CreateQuoteDialog } from "~/components/quotes/create-quote-dialog";
import { getAuthUser, requireAuth } from "~/lib/auth.server";
import { profilesService } from "~/services/profiles";
import { quotesService } from "~/services/quotes";
import { getGradient } from "~/utils/gradients";
import type { Route } from "./+types/profile";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { username } = params;

  // Case 1: Viewing a specific user profile (public or own)

  console.log("Username param:", username);
  if (username) {
    const { user: currentUser, supabase } = await getAuthUser(request);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    try {
      const response = await quotesService.getByUsername(username, 1, 100, session?.access_token);
      const isOwner = currentUser?.id === response.user.id;
      console.log("Is owner:", isOwner);
      console.log("Profile user:", response.user.username);

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

  // Case 2: Viewing own profile via /profile (requires auth)
  const { user, supabase } = await requireAuth(request);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw redirect("/");
  }

  // Fetch profile and quotes in parallel
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
    // Fallback or re-throw depending on desired behavior
    // For now, let's try to return a minimal state or re-throw a more friendly error
    throw new Response("Error loading profile", { status: 500 });
  }
}

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { profileUser, quotes, isOwner } = loaderData;

  // Format join date
  const joinDate = profileUser?.created_at
    ? new Date(profileUser.created_at).toLocaleDateString("es-CL", { month: "long", year: "numeric" })
    : "N/A";

  const displayName = profileUser.full_name || profileUser.username || "Usuario";

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header Profile */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
        <div className="flex items-center gap-6">
          <div className="h-24 w-24 rounded-full bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center text-3xl font-bold text-primary border border-primary/10 overflow-hidden">
            {profileUser.avatar_url ? (
              <img src={profileUser.avatar_url} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span>{displayName[0].toUpperCase()}</span>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">{displayName}</h1>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <IconCalendarFilled className="w-4 h-4" />
              <span>Se unió en {joinDate}</span>
            </div>
            <div className="text-muted-foreground text-sm">
              <span>
                <strong>{quotes.length}</strong> cotización(es) {isOwner ? "creada(s)" : "pública(s)"}
              </span>
            </div>
          </div>
        </div>

        {isOwner && <CreateQuoteDialog />}
      </div>

      <Separator className="my-4 border-1.5" />

      {/* Quotes Section */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold tracking-tight">
          {isOwner ? "Mis Cotizaciones" : `Cotizaciones de ${displayName}`}
        </h2>

        {quotes.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl bg-card/50">
            <div className="mx-auto w-12 h-12 rounded-full bg-secondary/30 flex items-center justify-center mb-4">
              <IconCpu className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">
              {isOwner ? "No tienes cotizaciones aún" : "Este usuario no tiene cotizaciones públicas"}
            </h3>
            {isOwner && (
              <>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Crea tu primera cotización para empezar a armar el PC de tus sueños.
                </p>
                <CreateQuoteDialog />
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {quotes.map((quote) => (
              <Link key={quote.id} to={`/cotizacion/${quote.id}`} className="group block">
                <div className="relative overflow-hidden bg-card hover:bg-secondary/10 border border-border/40 hover:border-primary/20 transition-all duration-300 rounded-2xl flex items-center p-2 gap-4 group-hover:shadow-lg group-hover:shadow-primary/5">
                  {/* Gradient Cover */}
                  <div className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-xl">
                    <div
                      className="h-full w-full transition-transform duration-500 group-hover:scale-110"
                      style={{ background: getGradient(quote.id) }}
                    />
                  </div>

                  <div className="flex-1 py-2 pr-4 flex items-center justify-between">
                    <div className="space-y-1.5">
                      <h3 className="font-bold text-lg group-hover:text-primary transition-colors tracking-tight">
                        {quote.name}
                      </h3>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-muted-foreground">
                        <span className="capitalize">
                          {new Date(quote.updated_at).toLocaleDateString("es-CL", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "numeric",
                            minute: "numeric",
                          })}
                        </span>
                        <span className="hidden sm:inline text-border/60">•</span>
                        <span className="font-medium">{quote.quote_items?.[0]?.count || 0} componentes</span>
                      </div>
                    </div>

                    <div className="text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300 pl-4">
                      <IconChevronRight className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  let message = "Ha ocurrido un error inesperado.";
  let details = "Por favor intenta nuevamente más tarde.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      message = "Usuario no encontrado";
      details = "El perfil que buscas no existe o ha sido eliminado.";
    } else if (error.status === 500) {
      message = "Error al cargar el perfil";
      details = "Hubo un problema al obtener los datos del usuario.";
    }
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-md text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
        <IconAlertCircle className="w-8 h-8 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">{message}</h1>
      <p className="text-muted-foreground mb-8">{details}</p>
      <Button>
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
