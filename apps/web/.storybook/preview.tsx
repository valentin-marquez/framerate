import type { Preview } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
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
          hydrationData: {
            loaderData: {
              root: {
                requestInfo,
                user: null,
                profile: null,
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
