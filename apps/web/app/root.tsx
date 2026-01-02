import "@/styles/app.css";
import { createBrowserClient } from "@supabase/ssr";
import { IconBrandGithub } from "@tabler/icons-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { data, isRouteErrorResponse, Link, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { Logo } from "@/components/layout/logo";
import { Navbar } from "@/components/layout/navbar";
import { useAuthSync } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { getAuthUser } from "@/lib/auth.server";
import { queryClient } from "@/lib/query-client";
import { profilesService } from "@/services/profiles";
import { useAuthStore } from "@/store/auth";
import type { Route } from "./+types/root";
import { Button } from "./components/primitives/button";
import { ThemeProvider } from "./components/theme/theme-provider";
import { categoriesService } from "./services/categories";

export const links: Route.LinksFunction = () => [{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }];

// Corregido lint/correctness/noEmptyPattern eliminando las llaves vacías
export function meta(_: Route.MetaArgs) {
  return [{ title: "Framerate" }, { name: "description", content: "Hardware price comparison tool." }];
}

export async function loader({ request }: Route.LoaderArgs) {
  // Eliminado themeSessionResolver ya que el tema ahora es puramente cliente
  const { user, supabase, headers: authHeaders } = await getAuthUser(request);
  const categories = await categoriesService.getAll();

  let profile = null;
  if (user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      try {
        profile = await profilesService.getMe(session.access_token);
      } catch (e) {
        console.error("Failed to fetch profile", e);
      }
    }
  }

  const env = {
    SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
    SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
  };

  return data(
    {
      env,
      user,
      profile,
      categories,
    },
    {
      headers: authHeaders,
    },
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />

        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Script necesario para evitar el flash de color antes de la hidratación
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'system';
                  var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  document.documentElement.classList.toggle('dark', isDark);
                } catch (e) {}
              })();
            `,
          }}
        />
        <Links />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>{children}</ThemeProvider>
        </QueryClientProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { env, user, profile, categories: initialCategories } = loaderData;
  const { setUser, setProfile, setSupabase } = useAuthStore();

  const { data: categories } = useCategories({ initialData: initialCategories });

  const [scrolled, setScrolled] = useState(false);

  const supabase = useMemo(
    () => createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY),
    [env.SUPABASE_URL, env.SUPABASE_ANON_KEY],
  );

  // Sync store immediately to avoid race conditions with queries
  const { supabase: currentSupabase, user: currentUser, profile: currentProfile } = useAuthStore.getState();
  if (currentSupabase !== supabase) {
    setSupabase(supabase);
  }
  if (currentUser?.id !== user?.id) {
    setUser(user);
  }
  if (currentProfile?.id !== profile?.id) {
    setProfile(profile);
  }

  useAuthSync(supabase);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex flex-col min-h-screen pb-16">
      <header className="sticky top-0 z-50 w-full">
        <Navbar categories={categories ?? []} blurred={scrolled} />
      </header>
      <main className="container mx-auto px-4 flex-1 pt-11">
        <Outlet />
      </main>

      <footer className="container mx-auto border-t border-border/60 py-4 md:py-0 max-w-4xl">
        <div className="flex flex-col items-center justify-between gap-4 md:h-20 md:flex-row px-4">
          <div className="flex items-center ">
            <Logo className="w-6 h-6 text-muted-foreground mr-4" />
            <Button variant="link">
              <Link to="/terms">Términos</Link>
            </Button>
            <Button variant="link">
              <Link to="/privacy">Privacidad</Link>
            </Button>
          </div>
          <div className="flex items-center gap-2 ">
            <Button variant="ghost" size="icon">
              <a href="https://github.com/valentin-marquez/framerate/" target="_blank" rel="noopener noreferrer">
                <IconBrandGithub className=" text-secondary-foreground" />
              </a>
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
