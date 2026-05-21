import "~/shared/styles/app.css";
import { createBrowserClient } from "@supabase/ssr";
import { IconBrandGithub } from "@tabler/icons-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  data,
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";
import { useAuthSync } from "~/features/auth/hooks/useAuth";
import { getAuthUser } from "~/features/auth/services/auth.server";
import { useAuthStore } from "~/features/auth/store/auth";
import { useCategories } from "~/features/category/hooks/useCategories";
import { categoriesService } from "~/features/category/services/categories";
import { profilesService } from "~/features/profile/services/profiles";
import { Logo } from "~/shared/components/layout/logo";
import { MorphSearch } from "~/shared/components/layout/morph-search";
import { Navbar } from "~/shared/components/layout/navbar";
import { Button } from "~/shared/components/primitives/button";
import { Toaster } from "~/shared/components/primitives/sonner";
import { useNonce } from "~/shared/hooks/use-nonce";
import { useOptionalRequestInfo } from "~/shared/hooks/use-request-info";
import { isRateLimitError } from "~/shared/lib/api";
import { getHints, useTheme } from "~/shared/lib/client";
import { getQueryClient } from "~/shared/lib/query-client";
import type { Lang } from "~/shared/lib/translations";
import { getClientEnv } from "~/shared/services/env.server";
import { getCookieLang, resolveLang, setLangCookie } from "~/shared/services/lang.server";
import { getTheme } from "~/shared/services/theme.server";
import type { Route } from "./+types/root";

export const links: Route.LinksFunction = () => [{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }];

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Framerate - Comparador de Precios de Hardware en Chile" },
    {
      name: "description",
      content:
        "Cotiza y compra hardware al mejor precio en Chile. Armar tu PC Gamer nunca fue tan fácil. Framerate compara precios de las mejores tiendas de tecnología.",
    },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Framerate.cl" },
    { property: "og:locale", content: "es_CL" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const clientEnv = getClientEnv();
  const { user, supabase, headers: authHeaders } = await getAuthUser(request);

  let categories: Awaited<ReturnType<typeof categoriesService.getAll>> = [];
  try {
    categories = await categoriesService.getAll();
  } catch (error) {
    // 429 (rate limit) es esperado bajo carga; degradamos a lista vacía y
    // dejamos que el cliente revalide. No es worth de console.error spam.
    if (!isRateLimitError(error)) {
      console.error("Failed to fetch categories in root loader:", error);
    }
  }

  let profile = null;
  if (user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      try {
        profile = await profilesService.getMe(session.access_token);
      } catch (e) {
        if (!isRateLimitError(e)) {
          console.error("Failed to fetch profile", e);
        }
      }
    }
  }

  const env = {
    SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
    SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
  };

  const headers = new Headers(authHeaders);

  if (!user) {
    // Cache for 1 minutes in browser, 5 minutes in CDN (if no cookie present mostly)
    // We add Vary: Cookie so that authenticated users don't get cached generic pages
    headers.set("Cache-Control", "public, max-age=60, s-maxage=300");
    headers.append("Vary", "Cookie");
  } else {
    headers.set("Cache-Control", "private, max-age=0, no-cache");
  }

  // Cookie wins (explicit per-device choice). Profile is fallback for first
  // visit on a new device. If we fall back to profile, persist the cookie so
  // future SSR is consistent and we don't depend on profile lookup.
  const profileLang = (profile?.lang as Lang | null | undefined) ?? null;
  const lang: Lang = resolveLang(request, profileLang);
  if (!getCookieLang(request)) {
    headers.append("Set-Cookie", setLangCookie(lang));
  }

  return data(
    {
      env,
      user,
      profile,
      categories,
      requestInfo: {
        clientEnv,
        hints: getHints(request),
        userPrefs: { theme: getTheme(request), lang },
        // Origin de la request — usado para construir la URL canónica en Layout.
        origin: new URL(request.url).origin,
      },
    },
    {
      headers,
    },
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const nonce = useNonce();
  const requestInfo = useOptionalRequestInfo();
  const lang = requestInfo?.userPrefs.lang ?? "es";
  const [queryClient] = useState(() => getQueryClient());

  // URL canónica self-referencing: origin + pathname, sin query params, para
  // que las variantes con filtros (estado en search params) consoliden en una
  // sola URL indexable. Ausente en error boundaries (sin requestInfo).
  const { pathname } = useLocation();
  const canonical = requestInfo?.origin ? requestInfo.origin + pathname : null;

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {canonical && <link rel="canonical" href={canonical} />}
        <Meta />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        <script
          nonce={nonce}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Script necesario para evitar el flash de color antes de la hidratación
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var isDark = false;
                  if (theme === 'dark') {
                    isDark = true;
                  } else if ((!theme || theme === 'system') && window.matchMedia) {
                    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  }
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
          {children}
          <Toaster position="bottom-center" />
        </QueryClientProvider>
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { env, user, profile, categories: initialCategories } = loaderData;
  const { setUser, setProfile, setSupabase } = useAuthStore();
  const theme = useTheme();

  const { data: categories } = useCategories({ initialData: initialCategories });

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  const supabase = useMemo(
    () => createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY),
    [env.SUPABASE_URL, env.SUPABASE_ANON_KEY],
  );

  useEffect(() => {
    setSupabase(supabase);
  }, [supabase, setSupabase]);

  useEffect(() => {
    setUser(user);
  }, [user, setUser]);

  useEffect(() => {
    setProfile(profile);
  }, [profile, setProfile]);

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

      {/* Buscador único flotante: se interpola de forma continua entre el
          ancla del hero y la del navbar según el scroll (sólo en "/"). */}
      <MorphSearch />

      <main className="container mx-auto px-4 flex-1 pt-11">
        <Outlet />
      </main>

      <footer className="container mx-auto border-t border-border/60 py-4 md:py-0 max-w-4xl">
        <div className="flex flex-col items-center justify-between gap-4 md:h-20 md:flex-row px-4">
          <div className="flex items-center ">
            <Logo className="size-6 text-muted-foreground mr-4" />
            <Button variant="link">
              <Link to="/terms">Términos</Link>
            </Button>
            <Button variant="link">
              <Link to="/privacy">Privacidad</Link>
            </Button>
          </div>
          <div className="flex items-center gap-2 ">
            <Button variant="ghost" size="icon">
              <a
                href="https://github.com/valentin-marquez/framerate/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub Repository"
              >
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
