import { useSyncExternalStore } from "react";
import { useFetcher } from "react-router";
import { useOptionalRequestInfo } from "~/shared/hooks/use-request-info";

export type Theme = "system" | "light" | "dark";

interface ThemeFormData {
  theme: Theme;
  redirectTo?: string;
}

const VALID_THEMES = new Set<string>(["system", "light", "dark"]);

export function parseThemeData(data: Record<string, unknown>): ThemeFormData {
  const theme = data.theme;
  if (typeof theme !== "string" || !VALID_THEMES.has(theme)) {
    throw new Error(`Invalid theme: ${String(theme)}`);
  }
  return {
    theme: theme as Theme,
    redirectTo: typeof data.redirectTo === "string" ? data.redirectTo : undefined,
  };
}

/**
 * Get current theme with optimistic updates support
 * @returns Current theme: "light" | "dark"
 * @public
 */
export function useTheme() {
  // Opcional: el Toaster de Layout también se monta en el ErrorBoundary del root, donde no hay datos del loader.
  const requestInfo = useOptionalRequestInfo();
  const optimisticMode = useOptimisticThemeMode();
  // Sin preferencia guardada manda el sistema: se lee en el cliente (el servidor no lo sabe y cae en "light").
  const system = useSystemTheme();

  if (optimisticMode) {
    return optimisticMode === "system" ? system : optimisticMode;
  }

  return requestInfo?.userPrefs.theme ?? system;
}

function subscribeToSystemTheme(onChange: () => void) {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useSystemTheme(): "light" | "dark" {
  return useSyncExternalStore(
    subscribeToSystemTheme,
    () => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    () => "light",
  );
}

/**
 * Get optimistic theme mode from pending form submissions
 * Used for immediate UI feedback before server response
 * @returns Optimistic theme mode or undefined
 * @public
 */
export function useOptimisticThemeMode() {
  const themeFetcher = useFetcher({ key: "theme-fetcher" });

  if (themeFetcher?.formData) {
    const formData = Object.fromEntries(themeFetcher.formData);
    const { theme } = parseThemeData(formData);
    return theme;
  }
}
