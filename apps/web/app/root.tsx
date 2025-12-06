import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";
import type { Route } from "./+types/root";
import "@/styles/app.css";
import { createBrowserClient } from "@supabase/ssr";
import clsx from "clsx";
import { useState } from "react";
import { PreventFlashOnWrongTheme, ThemeProvider, useTheme } from "remix-themes";
import { themeSessionResolver } from "./sessions.server";
import { BackgroundGrid } from "@/components/background-grid";
import { Navbar } from "@/components/navbar";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCategories } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase.server";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
];

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Framerate" },
    { name: "description", content: "Hardware price comparison tool." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { getTheme } = await themeSessionResolver(request);
  const { supabase, headers } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const categories = await getCategories();

  return {
    env: {
      SUPABASE_URL: (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL)!,
      SUPABASE_ANON_KEY: (process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!,
    },
    theme: getTheme(),
    user,
    categories,
  };
}

function AppLayout({ children, ssrTheme }: { children: React.ReactNode; ssrTheme: boolean }) {
  const [theme] = useTheme();
  return (
    <html lang="en" className={clsx(theme ?? "")}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <PreventFlashOnWrongTheme ssrTheme={ssrTheme} />
        <script crossOrigin="anonymous" src="//unpkg.com/react-scan/dist/auto.global.js" />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<Route.LoaderData>("root");
  return (
    <ThemeProvider specifiedTheme={data?.theme} themeAction="/action/set-theme">
      <AppLayout ssrTheme={Boolean(data?.theme)}>{children}</AppLayout>
    </ThemeProvider>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { env, user, categories } = loaderData;
  const [supabase] = useState(() => createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY));

  return (
    <div className="flex flex-col min-h-screen">
      <BackgroundGrid />
      <header className="sticky top-0 z-50 w-full">
        <Navbar supabase={supabase} user={user} categories={categories} />
      </header>
      <main className="flex-1">
        <Outlet context={{ supabase, user }} />
      </main>

      <footer className="border-t border-border py-6 md:py-0 bg-accent">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row mx-auto px-4">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            &copy; {new Date().getFullYear()} Framerate.
          </p>
          <ThemeToggle />
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
    details =
      error.status === 404 ? "The requested page could not be found." : error.statusText || details;
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
