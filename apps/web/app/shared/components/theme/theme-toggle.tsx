import { IconMoon, IconSun } from "@tabler/icons-react";
import { useFetcher } from "react-router";
import { useTheme } from "~/shared/lib/client";
import { cn } from "~/shared/lib/utils";
import { Button } from "../primitives/button";

/**
 * Alterna claro y oscuro sin sesión: guarda la cookie con la misma ruta que Ajustes. El ícono es el del modo actual
 * (luna en oscuro, sol en claro) y sale del `<html>` por CSS, no del estado: el script del head ya fijó la clase, así no
 * cambia al hidratar con el tema del sistema.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const fetcher = useFetcher({ key: "theme-fetcher" });
  const dark = useTheme() === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Cambiar entre tema claro y oscuro"
      className={cn("shrink-0 rounded-xl border-border/60", className)}
      onClick={() => fetcher.submit({ theme: dark ? "light" : "dark" }, { method: "post", action: "/theme-switcher" })}
    >
      <IconMoon className="hidden size-[18px] dark:block" />
      <IconSun className="size-[18px] dark:hidden" />
    </Button>
  );
}
