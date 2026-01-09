import { IconCheck, IconDeviceLaptop, IconMoon, IconSun } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useFetcher } from "react-router";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/primitives/select";
import { Separator } from "~/components/primitives/separator";
import { useRequestInfo } from "~/hooks/use-request-info";
import { useTranslation } from "~/hooks/use-translation";
import { requireAuth } from "~/lib/auth.server";
import { useOptimisticThemeMode } from "~/lib/client";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/preferences";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return null;
}

export default function PreferencesSettings() {
  const fetcher = useFetcher({ key: "theme-fetcher" });
  const requestInfo = useRequestInfo();
  const optimisticMode = useOptimisticThemeMode();
  const theme = optimisticMode ?? requestInfo.userPrefs.theme ?? "system";
  const { t, lang, setLanguage } = useTranslation();

  const setTheme = (t: string) => {
    fetcher.submit({ theme: t }, { method: "post", action: "/theme-switcher" });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium">{t("preferences")}</h2>
        <p className="text-sm text-muted-foreground">{t("preferences_desc")}</p>
      </div>

      <Separator />

      <div className="space-y-8">
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">{t("visualization")}</h3>
            <p className="text-sm text-muted-foreground">{t("choose_theme")}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ThemeCard id="system" label={t("system")} active={theme === "system"} onClick={() => setTheme("system")}>
              <div
                className="h-full w-full flex items-center justify-center relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #FFD54F 0%, #FFB74D 40%, #4c1d95 60%, #1e1b4b 100%)",
                }}
              >
                <div className="absolute inset-0 bg-grid-white/[0.1]" />
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <div className="rounded-lg bg-white/20 backdrop-blur-md p-3 shadow-xl border border-white/30">
                    <IconDeviceLaptop className="w-8 h-8 text-white" />
                  </div>
                  <div className="h-1.5 w-12 bg-white/30 rounded-full" />
                </div>
              </div>
            </ThemeCard>

            <ThemeCard id="light" label={t("light")} active={theme === "light"} onClick={() => setTheme("light")}>
              <div
                className="h-full w-full relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, #FFB74D 0%, #FFD54F 100%)" }}
              >
                <div className="absolute top-3 left-3 right-[-20%] bottom-[-20%] rounded-tl-lg border-l border-t border-zinc-200 bg-white shadow-xl flex flex-col">
                  <div className="h-6 w-full border-b border-zinc-100 flex items-center px-2 gap-1.5 bg-white rounded-tl-lg">
                    <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
                    <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
                    <div className="w-2 h-2 rounded-full bg-[#28c840]" />
                  </div>

                  <div className="flex-1 p-3 space-y-3 bg-zinc-50/50">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-md bg-white border border-zinc-200 shadow-sm shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-2 w-3/4 bg-zinc-200 rounded-full" />
                        <div className="h-2 w-1/2 bg-zinc-100 rounded-full" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-12 w-full bg-white border border-zinc-200 rounded-md shadow-sm" />
                      <div className="h-2 w-full bg-zinc-100 rounded-full" />
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 p-1.5 bg-white rounded-full shadow-sm border border-zinc-200 z-10">
                  <IconSun className="w-4 h-4 text-amber-500" />
                </div>
              </div>
            </ThemeCard>

            <ThemeCard id="dark" label={t("dark")} active={theme === "dark"} onClick={() => setTheme("dark")}>
              <div
                className="dark h-full w-full relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%)" }}
              >
                <div className="absolute top-3 left-3 right-[-20%] bottom-[-20%] rounded-tl-lg border-l border-t border-border bg-background shadow-xl flex flex-col">
                  <div className="h-6 w-full border-b border-border bg-muted flex items-center px-2 gap-1.5 rounded-tl-lg">
                    <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
                    <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
                    <div className="w-2 h-2 rounded-full bg-[#28c840]" />
                  </div>

                  <div className="flex-1 p-3 space-y-3">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-md bg-muted border border-border shadow-sm shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-2 w-3/4 bg-muted rounded-full" />
                        <div className="h-2 w-1/2 bg-muted/50 rounded-full" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-12 w-full bg-muted/30 border border-border rounded-md shadow-sm" />
                      <div className="h-2 w-full bg-muted/50 rounded-full" />
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 p-1.5 bg-zinc-800 rounded-full shadow-sm border border-zinc-700 z-10">
                  <IconMoon className="w-4 h-4 text-indigo-400" />
                </div>
              </div>
            </ThemeCard>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div>
            <h3 className="font-medium">{t("language")}</h3>
            <p className="text-sm text-muted-foreground">{t("select_language")}</p>
          </div>

          <div className="w-full sm:max-w-md">
            <Select value={lang} onValueChange={(v) => setLanguage(v as any)}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="arn">Mapudungun</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeCard({
  label,
  active,
  onClick,
  children,
}: {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-start gap-2 rounded-xl border-2 transition-all bg-card text-left cursor-pointer overflow-hidden",
        active ? "grayscale-0" : "grayscale hover:grayscale-0 hover:border-border",
      )}
    >
      <div className={cn("aspect-12/5 w-full overflow-hidden border transition-all")}>{children}</div>
      <div className="flex w-full items-center justify-between px-1 py-1">
        <span className="text-sm font-medium">{label}</span>
        <AnimatePresence>
          {active && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2 }}
              className="rounded-full bg-primary p-0.5 text-primary-foreground"
            >
              <IconCheck className="h-3 w-3 text-primary-foreground" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </button>
  );
}
