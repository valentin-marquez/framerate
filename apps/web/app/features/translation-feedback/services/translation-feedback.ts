import type { CreateTranslationFeedbackRequest } from "@framerate/contracts";
import { api } from "~/shared/lib/api";

export const translationFeedbackService = {
  submit: (payload: CreateTranslationFeedbackRequest) => api.post<{ id: number }>("/v1/translation-feedback", payload),
};
