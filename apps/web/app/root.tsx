import "~/shared/styles/app.css";
import type { AuthProviders, Freshness } from "@framerate/contracts";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
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
  useRouteLoaderData,
} from "react-router";

import { AuthFlash } from "~/features/auth/components/auth-flash";
import { getAuthUser } from "~/features/auth/services/auth.server";
import { useCategories } from "~/features/category/hooks/useCategories";
import { categoriesService } from "~/features/category/services/categories";
import { meToProfile } from "~/features/profile/services/profiles";
import { Logo } from "~/shared/components/layout/logo";
import { Navbar } from "~/shared/components/layout/navbar";
import { SiteFooter } from "~/shared/components/layout/site-footer";
import { Button } from "~/shared/components/primitives/button";
import { Toaster } from "~/shared/components/primitives/sonner";
import { useNonce } from "~/shared/hooks/use-nonce";
import { useOptionalRequestInfo } from "~/shared/hooks/use-request-info";
import { api, isRateLimitError } from "~/shared/lib/api";
import { useTheme } from "~/shared/lib/client";
import { markInitialLoadDone } from "~/shared/lib/initial-load";
import { getQueryClient } from "~/shared/lib/query-client";
import type { Lang } from "~/shared/lib/translations";
import { cn } from "~/shared/lib/utils";
import { getClientEnv } from "~/shared/services/env.server";
import { getCookieLang, resolveLang, setLangCookie } from "~/shared/services/lang.server";
import { getTheme } from "~/shared/services/theme.server";
import satoshiUrl from "~/shared/styles/fonts/Satoshi-Variable.woff2?url";
import type { Route } from "./+types/root";

// `sizes` en el .ico hace que los navegadores con soporte de SVG prefieran el SVG.
export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  // Satoshi se aleja más que Inter de las fuentes de respaldo: precargarla acorta el salto del texto al cambiar.
  { rel: "preload", href: satoshiUrl, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
];

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
  const [{ user, headers: authHeaders }, categories, providers, freshness] = await Promise.all([
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
    // Sin frescura el riel simplemente no la muestra.
    api
      .get<Freshness>("/v1/freshness")
      .catch(() => null),
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
      freshness,
      // Riel del navbar plegado: lo sabe el servidor para no mover el layout al hidratar.
      railCollapsed: /(?:^|;\s*)rail=collapsed/.test(request.headers.get("Cookie") ?? ""),
      requestInfo: {
        clientEnv,
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
  // Igual con el riel plegado: después lo cambia el Navbar directo en el <html>, sin volver a renderizar la página.
  const rootData = useRouteLoaderData<typeof loader>("root");
  const [railCollapsed] = useState(() => rootData?.railCollapsed ?? false);

  // URL canónica self-referencing: origin + pathname, sin query params, para
  // que las variantes con filtros (estado en search params) consoliden en una
  // sola URL indexable. Ausente en error boundaries (sin requestInfo).
  const { pathname } = useLocation();
  const canonical = requestInfo?.origin ? requestInfo.origin + pathname : null;

  return (
    <html
      lang={lang}
      className={savedTheme ?? undefined}
      data-theme={savedTheme ?? "system"}
      data-rail={railCollapsed ? "collapsed" : "open"}
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        {canonical && <link rel="canonical" href={canonical} />}
        <Meta />

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
          {/* Después del Toaster: su efecto corre cuando el Toaster ya escucha y el aviso de la primera carga no se pierde. */}
          <AuthFlash />
        </QueryClientProvider>
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { categories: initialCategories, railCollapsed } = loaderData;
  const theme = useTheme();

  const { data: categories } = useCategories({ initialData: initialCategories });
  // El root no se vuelve a pedir al navegar: la frescura se refresca sola mientras la pestaña sigue abierta.
  const { data: freshness } = useQuery({
    queryKey: ["freshness"],
    queryFn: () => api.get<Freshness>("/v1/freshness"),
    initialData: loaderData.freshness ?? undefined,
    staleTime: 60_000,
    refetchInterval: 10 * 60_000,
  });

  const navigating = useNavigation().state !== "idle";

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
    // Efectos caros (desenfoque, transiciones de ancho) sólo en equipos holgados; ver data-motion en app.css.
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    if ((navigator.hardwareConcurrency ?? 4) >= 8 && memory >= 8) document.documentElement.dataset.motion = "rich";
    const timer = setTimeout(markInitialLoadDone, 1600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip pb-16">
      <div
        aria-hidden="true"
        className={cn(
          "load-bar fixed right-0 top-14 z-[60] h-0.5 origin-left bg-primary transition-[opacity,transform] lg:top-0",
          navigating ? "scale-x-75 opacity-100 duration-[3000ms] ease-out" : "scale-x-100 opacity-0 duration-300",
        )}
      />
      <Navbar categories={categories ?? []} freshness={freshness} initialCollapsed={railCollapsed} />

      {/* El hueco del riel (w-64, o w-16 plegado) sale de `data-rail` en app.css. */}
      <div className="page-content flex flex-1 flex-col">
        <main className="container mx-auto px-4 flex-1 pt-6 lg:pt-11">
          <Outlet />
        </main>

        <SiteFooter />
      </div>
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
        <Button size="lg" variant="outline" nativeButton={false} render={<Link to="/buscar" />}>
          Ver el catálogo
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
