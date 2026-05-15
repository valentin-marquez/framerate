import { useCallback } from "react";
import { useFetcher } from "react-router";
import { useAuthStore } from "~/features/auth/store/auth";
import { profilesService } from "~/features/profile/services/profiles";
import { useRequestInfo } from "~/shared/hooks/use-request-info";
import { getTranslation, type Lang } from "~/shared/lib/translations";

export function useOptimisticLang(): Lang | undefined {
  const fetcher = useFetcher({ key: "lang-fetcher" });
  if (fetcher?.formData) {
    const value = fetcher.formData.get("lang");
    if (value === "es" || value === "en" || value === "arn") return value;
  }
  return undefined;
}

export function useTranslation() {
  const requestInfo = useRequestInfo();
  const optimistic = useOptimisticLang();
  const { setProfile, supabase } = useAuthStore();
  // requestInfo.userPrefs.lang is the source of truth (root loader keeps cookie
  // and profile.lang in sync per request). Optimistic value flips it instantly.
  const lang: Lang = optimistic ?? requestInfo.userPrefs.lang ?? "es";

  const fetcher = useFetcher({ key: "lang-fetcher" });

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => getTranslation(lang, key, params),
    [lang],
  );

  const setLanguage = useCallback(
    async (next: Lang) => {
      // Persist to cookie immediately so SSR / non-authed users keep the choice.
      fetcher.submit({ lang: next }, { method: "post", action: "/lang-switcher" });

      // For authed users, also sync to profile so it follows them across devices.
      // Leemos el profile actual con getState() para evitar el patrón "spread from closure"
      // (setProfile de zustand no soporta updater functions).
      const currentProfile = useAuthStore.getState().profile;
      if (currentProfile) {
        setProfile({ ...currentProfile, lang: next });
        try {
          const { data } = (await supabase?.auth.getSession()) ?? {};
          const token = data?.session?.access_token;
          if (token) await profilesService.updateMe({ lang: next }, token);
        } catch (e) {
          console.error("Failed to sync language to profile", e);
        }
      }
    },
    [fetcher, setProfile, supabase],
  );

  return { t, lang, setLanguage };
}
