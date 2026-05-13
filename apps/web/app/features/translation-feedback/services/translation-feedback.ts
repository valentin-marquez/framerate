import { api } from "~/shared/lib/api";
import type { Lang } from "~/shared/lib/translations";

export interface TranslationFeedbackPayload {
  lang: Lang;
  translation_key: string;
  current_text: string;
  suggested_text: string;
  comment?: string;
  context_url?: string;
}

export const translationFeedbackService = {
  submit: (payload: TranslationFeedbackPayload, token?: string) =>
    api.post<{ result: "ok" }>("/v1/translation-feedback", payload, { token }),
};
