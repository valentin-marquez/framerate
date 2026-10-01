import type { Preview } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { useAuthStore } from "../app/features/auth/store/auth";
import "../app/shared/styles/app.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
});

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Tema",
      toolbar: {
        title: "Tema",
        icon: "mirror",
        items: [
          { value: "light", title: "Claro" },
          { value: "dark", title: "Oscuro" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  parameters: {
    layout: "padded",
    controls: { expanded: true },
  },
  decorators: [
    (Story, { globals, parameters }) => {
      // Mismo mecanismo que el sitio: la clase del <html> decide el tema.
      useEffect(() => {
        document.documentElement.classList.toggle("dark", globals.theme === "dark");
        document.body.classList.add("bg-background", "text-foreground");
      }, [globals.theme]);
      const user = parameters.session?.user ?? null;
      const profile = parameters.session?.profile ?? null;
      // Igual que `root.tsx`: el espejo heredado (`useAuthStore`) lo leen todavía reseñas y soporte.
      useEffect(() => {
        useAuthStore.setState({ user, profile });
      }, [user, profile]);
      // Router de datos en memoria: los componentes usan Link, useSearchParams, useNavigation y los datos del
      // loader raíz del sitio (`requestInfo`), que aquí se simulan.
      const theme = globals.theme === "dark" ? "dark" : "light";
      const requestInfo = {
        clientEnv: {},
        hints: { theme, timeZone: "America/Santiago" },
        userPrefs: { theme, lang: "es" },
        origin: "http://localhost:6006",
      };
      const router = createMemoryRouter(
        [{ id: "root", element: <Outlet />, children: [{ path: "*", element: <Story /> }] }],
        {
          // Una historia puede abrir otra URL (filtros en la query, pestaña activa) con `parameters.path`.
          initialEntries: [parameters.path ?? "/"],
          hydrationData: {
            loaderData: {
              root: {
                requestInfo,
                // Una historia simula la sesión con `parameters.session` ({ user, profile }).
                user,
                profile,
                // Una historia puede cambiarlos con `parameters.providers`.
                providers: parameters.providers ?? [{ id: "discord", label: "Discord" }],
                categories: [],
              },
            },
          },
        },
      );
      return (
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      );
    },
  ],
};

export default preview;
