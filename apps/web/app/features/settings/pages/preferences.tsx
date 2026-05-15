import { IconCheck, IconDeviceLaptop, IconFlask, IconMessage, IconMoon, IconSun } from "@tabler/icons-react";
import { AnimatePresence, domAnimation, LazyMotion, m } from "motion/react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { requireAuth } from "~/features/auth/services/auth.server";
import { FeedbackDialog } from "~/features/translation-feedback/components/feedback-dialog";
import { Button } from "~/shared/components/primitives/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/shared/components/primitives/select";
import { Separator } from "~/shared/components/primitives/separator";
import { useRequestInfo } from "~/shared/hooks/use-request-info";
import { useTranslation } from "~/shared/hooks/use-translation";
import { type Theme, useOptimisticThemeMode } from "~/shared/lib/client";
import { cn } from "~/shared/lib/utils";
import type { Route } from "./+types/preferences";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return null;
}

type ThemeOption = Theme;

const LANG_LABELS = {
  es: "Español",
  en: "English",
  arn: "Mapudungun",
} as const;

const BETA_LANGS = new Set<string>(["en", "arn"]);

export default function PreferencesSettings() {
  const fetcher = useFetcher({ key: "theme-fetcher" });
  const requestInfo = useRequestInfo();
  const optimisticMode = useOptimisticThemeMode();
  const theme: ThemeOption = optimisticMode ?? requestInfo.userPrefs.theme ?? "system";
  const { t, lang, setLanguage } = useTranslation();

  const selectTheme = (next: ThemeOption) => {
    fetcher.submit({ theme: next }, { method: "post", action: "/theme-switcher" });
  };

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const isBeta = BETA_LANGS.has(lang);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium tracking-tight">{t("preferences")}</h2>
        <p className="text-sm text-muted-foreground">{t("preferences_desc")}</p>
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="font-medium tracking-tight">{t("visualization")}</h3>
          <p className="text-sm text-muted-foreground">{t("choose_theme")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ThemeCard
            label={t("system")}
            icon={<IconDeviceLaptop className="size-4" />}
            active={theme === "system"}
            onClick={() => selectTheme("system")}
          >
            <div className="absolute inset-0 grid grid-cols-2">
              <ThemePreview variant="light" />
              <ThemePreview variant="dark" />
            </div>
          </ThemeCard>

          <ThemeCard
            label={t("light")}
            icon={<IconSun className="size-4" />}
            active={theme === "light"}
            onClick={() => selectTheme("light")}
          >
            <ThemePreview variant="light" />
          </ThemeCard>

          <ThemeCard
            label={t("dark")}
            icon={<IconMoon className="size-4" />}
            active={theme === "dark"}
            onClick={() => selectTheme("dark")}
          >
            <ThemePreview variant="dark" />
          </ThemeCard>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="font-medium tracking-tight">{t("language")}</h3>
          <p className="text-sm text-muted-foreground">{t("select_language")}</p>
        </div>

        <div className="w-full sm:max-w-xs">
          <Select value={lang} onValueChange={(v) => setLanguage(v as Parameters<typeof setLanguage>[0])}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue>{(value: string) => LANG_LABELS[value as keyof typeof LANG_LABELS] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(LANG_LABELS) as (keyof typeof LANG_LABELS)[]).map((code) => (
                <SelectItem key={code} value={code}>
                  {LANG_LABELS[code]}
                  {BETA_LANGS.has(code) && (
                    <span className="ml-2 text-[10px] uppercase text-muted-foreground">beta</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isBeta && (
          <div className="rounded-2xl border border-border/60 bg-secondary/30 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-3 flex-1">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <IconFlask className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">{t("translation_beta_title")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("translation_beta_desc")}</p>
              </div>
            </div>
            <Button variant="secondary" className="gap-2 shrink-0" onClick={() => setFeedbackOpen(true)}>
              <IconMessage className="size-4" />
              {t("suggest_correction")}
            </Button>
          </div>
        )}
      </div>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} lang={lang} />
    </div>
  );
}

function ThemeCard({
  label,
  icon,
  active,
  onClick,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <LazyMotion features={domAnimation}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          "group flex flex-col items-stretch gap-2 rounded-2xl p-1.5 text-left transition-all cursor-pointer",
          "border-2 bg-card",
          active ? "border-primary shadow-sm" : "border-transparent hover:border-border focus-visible:border-border",
        )}
      >
        <div className="relative aspect-12/5 w-full overflow-hidden rounded-xl border border-border/40">{children}</div>
        <div className="flex w-full items-center justify-between px-1.5 py-1">
          <span className="flex items-center gap-2 text-sm font-medium">
            <span className="text-muted-foreground">{icon}</span>
            {label}
          </span>
          <AnimatePresence>
            {active && (
              <m.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.15 }}
                className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <IconCheck className="size-3" />
              </m.span>
            )}
          </AnimatePresence>
        </div>
      </button>
    </LazyMotion>
  );
}

const PREVIEW_TOKENS = {
  light: {
    background: "oklch(0.9787 0.0017 247.84)",
    card: "oklch(0.9963 0.0011 197.14)",
    secondary: "oklch(0.9516 0.0017 247.84)",
    border: "oklch(0.145 0 0 / 0.1)",
    foreground: "oklch(0.145 0 0)",
    muted: "oklch(0.556 0 0)",
  },
  dark: {
    background: "oklch(0.1944 0.0051 248.09)",
    card: "oklch(0.2337 0.0049 248.04)",
    secondary: "oklch(0.27 0.005 248)",
    border: "oklch(0.27 0.005 248)",
    foreground: "oklch(0.985 0 0)",
    muted: "oklch(0.70 0 0)",
  },
} as const;

function ThemePreview({ variant }: { variant: "light" | "dark" }) {
  const c = PREVIEW_TOKENS[variant];
  return (
    <div className="size-full p-2" style={{ background: c.background }}>
      <div
        className="size-full rounded-md border flex flex-col overflow-hidden shadow-sm"
        style={{ background: c.card, borderColor: c.border }}
      >
        <div className="flex items-center gap-1 px-1.5 py-1 border-b" style={{ borderColor: c.border }}>
          <span className="size-1.5 rounded-full bg-[#ff5f57]" />
          <span className="size-1.5 rounded-full bg-[#febc2e]" />
          <span className="size-1.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 flex">
          <div className="w-1/3 border-r p-1.5 space-y-1" style={{ borderColor: c.border }}>
            <div className="h-1 w-full rounded-full" style={{ background: c.secondary }} />
            <div className="h-1 w-3/4 rounded-full" style={{ background: c.secondary }} />
            <div className="h-1 w-2/3 rounded-full" style={{ background: c.secondary }} />
          </div>
          <div className="flex-1 p-1.5 space-y-1">
            <div className="h-1.5 w-1/2 rounded-full" style={{ background: c.foreground, opacity: 0.85 }} />
            <div className="h-1 w-full rounded-full" style={{ background: c.muted, opacity: 0.4 }} />
            <div className="h-1 w-5/6 rounded-full" style={{ background: c.muted, opacity: 0.4 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
