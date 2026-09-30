import {
  IconCheck,
  IconDeviceLaptop,
  IconFlask,
  IconLanguage,
  IconMessage,
  IconMoon,
  IconSun,
} from "@tabler/icons-react";
import { AnimatePresence, domAnimation, LazyMotion, m } from "motion/react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { requireAuth } from "~/features/auth/services/auth.server";
import { FeedbackDialog } from "~/features/translation-feedback/components/feedback-dialog";
import { Button } from "~/shared/components/primitives/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/shared/components/primitives/select";
import { useRequestInfo } from "~/shared/hooks/use-request-info";
import { useTranslation } from "~/shared/hooks/use-translation";
import { type Theme, useOptimisticThemeMode } from "~/shared/lib/client";
import { cn } from "~/shared/lib/utils";
import { SettingsBadge, SettingsGroup, SettingsRow, SettingsSection } from "../components/settings-parts";
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
      <SettingsSection title={t("visualization")} description={t("choose_theme")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
      </SettingsSection>

      <SettingsSection title={t("language")} description={t("select_language")}>
        <SettingsGroup>
          <SettingsRow
            icon={IconLanguage}
            title={t("language")}
            description={isBeta ? t("translation_beta_desc") : undefined}
            badge={isBeta ? <SettingsBadge>beta</SettingsBadge> : undefined}
            action={
              <Select value={lang} onValueChange={(v) => setLanguage(v as Parameters<typeof setLanguage>[0])}>
                <SelectTrigger className="h-9 w-full sm:w-44">
                  <SelectValue>
                    {(value: string) => LANG_LABELS[value as keyof typeof LANG_LABELS] ?? value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LANG_LABELS) as (keyof typeof LANG_LABELS)[]).map((code) => (
                    <SelectItem key={code} value={code}>
                      {LANG_LABELS[code]}
                      {BETA_LANGS.has(code) && (
                        <span className="ml-2 text-[10px] text-muted-foreground uppercase">beta</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
          {isBeta && (
            <SettingsRow
              icon={IconFlask}
              title={t("translation_beta_title")}
              action={
                <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setFeedbackOpen(true)}>
                  <IconMessage className="size-4" />
                  {t("suggest_correction")}
                </Button>
              }
            />
          )}
        </SettingsGroup>
      </SettingsSection>

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

// Copia fija de los tokens de cada tema (app.css): la vista previa debe verse igual sin importar el tema activo.
const PREVIEW_TOKENS = {
  light: {
    background: "oklch(0.978 0 0)",
    card: "oklch(1 0 0)",
    secondary: "oklch(0.948 0 0)",
    border: "oklch(0.2 0 0 / 0.08)",
    foreground: "oklch(0.2 0 0)",
    muted: "oklch(0.52 0 0)",
  },
  dark: {
    background: "oklch(0.175 0 0)",
    card: "oklch(0.215 0 0)",
    secondary: "oklch(0.26 0 0)",
    border: "oklch(1 0 0 / 0.09)",
    foreground: "oklch(0.97 0 0)",
    muted: "oklch(0.68 0 0)",
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
