import "~/shared/styles/app.css";
import type { AuthProviders } from "@framerate/contracts";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  data,
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  type ShouldRevalidateFunctionArgs,
  useLocation,
  useNavigation,
} from "react-router";
import { getAuthUser } from "~/features/auth/services/auth.server";
import { useAuthStore } from "~/features/auth/store/auth";
import { useCategories } from "~/features/category/hooks/useCategories";
import { categoriesService } from "~/features/category/services/categories";
import { meToProfile } from "~/features/profile/services/profiles";
import { Logo } from "~/shared/components/layout/logo";
import { MorphSearch } from "~/shared/components/layout/morph-search";
import { Navbar } from "~/shared/components/layout/navbar";
import { SiteFooter } from "~/shared/components/layout/site-footer";
import { Button } from "~/shared/components/primitives/button";
import { Toaster } from "~/shared/components/primitives/sonner";
import { useNonce } from "~/shared/hooks/use-nonce";
import { useOptionalRequestInfo } from "~/shared/hooks/use-request-info";
import { api, isRateLimitError } from "~/shared/lib/api";
import { getHints, useTheme } from "~/shared/lib/client";
import { markInitialLoadDone } from "~/shared/lib/initial-load";
import { getQueryClient } from "~/shared/lib/query-client";
import type { Lang } from "~/shared/lib/translations";
import { getClientEnv } from "~/shared/services/env.server";
import { getCookieLang, resolveLang, setLangCookie } from "~/shared/services/lang.server";
import { getTheme } from "~/shared/services/theme.server";
import type { Route } from "./+types/root";

export const links: Route.LinksFunction = () => [{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }];

export function meta({ error }: Route.MetaArgs) {
  if (error) {
    const notFound = isRouteErrorResponse(error) && error.status === 404;
    return [{ title: notFound ? "Página no encontrada - Framerate" : "Error - Framerate" }];
  }
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

// El root sólo se vuelve a pedir tras un envío (login/logout, idioma...), no en cada navegación.
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return formMethod && formMethod !== "GET" ? defaultShouldRevalidate : false;
}

export async function loader({ request }: Route.LoaderArgs) {
  const clientEnv = getClientEnv();
  const [{ user, headers: authHeaders }, categories, providers] = await Promise.all([
    getAuthUser(request),
    categoriesService.getAll().catch((error) => {
      // 429 (rate limit) es esperado bajo carga; degradamos a lista vacía y el cliente revalida.
      if (!isRateLimitError(error)) console.error("Failed to fetch categories in root loader:", error);
      return [] as Awaited<ReturnType<typeof categoriesService.getAll>>;
    }),
    api
      .get<AuthProviders>("/v1/auth/providers")
      .then((response) => response.items)
      .catch(() => []),
  ]);

  const profile = user ? meToProfile(user) : null;

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
      user,
      profile,
      providers,
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
  // Tema guardado (cookie) para pintar el <html> ya correcto en el HTML del servidor. Se fija una sola vez: después
  // la clase la maneja el efecto de App, y así React no la pisa al cambiar de tema.
  const [savedTheme] = useState(() => requestInfo?.userPrefs.theme ?? null);

  // URL canónica self-referencing: origin + pathname, sin query params, para
  // que las variantes con filtros (estado en search params) consoliden en una
  // sola URL indexable. Ausente en error boundaries (sin requestInfo).
  const { pathname } = useLocation();
  const canonical = requestInfo?.origin ? requestInfo.origin + pathname : null;

  return (
    <html lang={lang} className={savedTheme ?? undefined} data-theme={savedTheme ?? "system"} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
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
                var root = document.documentElement;
                var saved = root.dataset.theme;
                var dark = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                root.classList.toggle('dark', dark);
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
  const { user, profile, categories: initialCategories } = loaderData;
  const { setUser, setProfile } = useAuthStore();
  const theme = useTheme();

  const { data: categories } = useCategories({ initialData: initialCategories });

  const navigating = useNavigation().state !== "idle";
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

  useEffect(() => {
    const timer = setTimeout(markInitialLoadDone, 1600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setUser(user);
  }, [user, setUser]);

  useEffect(() => {
    setProfile(profile);
  }, [profile, setProfile]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex flex-col min-h-screen pb-16">
      <div
        aria-hidden="true"
        className={`fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-primary transition-[opacity,transform] ${
          navigating ? "scale-x-75 opacity-100 duration-[3000ms] ease-out" : "scale-x-100 opacity-0 duration-300"
        }`}
      />
      <header className="sticky top-0 z-50 w-full">
        <Navbar categories={categories ?? []} blurred={scrolled} />
      </header>

      {/* Buscador único flotante: se interpola de forma continua entre el
          ancla del hero y la del navbar según el scroll (sólo en "/"). */}
      <MorphSearch />

      <main className="container mx-auto px-4 flex-1 pt-11">
        <Outlet />
      </main>

      <SiteFooter />
    </div>
  );
}

const ERROR_COPY: Record<number, { title: string; details: string }> = {
  401: { title: "Inicia sesión para continuar", details: "Esta página necesita que entres con tu cuenta." },
  403: { title: "No tienes acceso", details: "Tu cuenta no tiene permiso para ver esta página." },
  404: {
    title: "No encontramos esta página",
    details: "Puede que el enlace esté roto o que la página ya no exista.",
  },
};

const GENERIC_ERROR = {
  title: "Algo salió mal",
  details: "Tuvimos un problema al cargar esta página. Intenta de nuevo en unos minutos.",
};

// Se renderiza dentro de Layout pero sin App (sin navbar ni footer) y, si falló el root, sin datos del loader.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const { title, details } = ERROR_COPY[status] ?? GENERIC_ERROR;
  const stack = import.meta.env.DEV && error instanceof Error ? error.stack : undefined;

  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
      <Link to="/" aria-label="Framerate, ir al inicio" className="mb-10">
        <Logo className="size-9" />
      </Link>
      <p className="font-mono text-sm tabular-nums text-muted-foreground">{status}</p>
      <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-md text-balance text-muted-foreground">{details}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" nativeButton={false} render={<Link to="/" />}>
          Ir al inicio
        </Button>
        <Button size="lg" variant="outline" nativeButton={false} render={<Link to="/explorar" />}>
          Explorar productos
        </Button>
      </div>
      {stack && (
        <pre className="mt-10 w-full overflow-x-auto rounded-xl bg-secondary p-4 text-left text-xs">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
