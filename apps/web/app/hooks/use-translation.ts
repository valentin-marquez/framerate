import { useCallback } from "react";
import { useRevalidator } from "react-router";
import { getTranslation, type Lang } from "~/lib/translations";
import { profilesService } from "~/services/profiles";
import { useAuthStore } from "~/store/auth";

export function useTranslation() {
  const { profile, setProfile, supabase } = useAuthStore();
  const lang = (profile?.lang as Lang) || "es";
  const revalidator = useRevalidator();

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return getTranslation(lang, key, params);
    },
    [lang],
  );

  const setLanguage = async (newLang: Lang) => {
    // Optimistic update
    if (profile) {
      setProfile({ ...profile, lang: newLang });

      const { data } = (await supabase?.auth.getSession()) || {};
      const token = data?.session?.access_token;

      if (token) {
        try {
          await profilesService.updateMe({ lang: newLang }, token);
          revalidator.revalidate();
        } catch (e) {
          console.error("Failed to update language", e);
        }
      }
    }
  };

  return { t, lang, setLanguage };
}
