import type {
  AddQuoteItemRequest,
  CreateQuoteRequest,
  QuoteDetail,
  QuotePage,
  QuoteVisibility,
  UpdateQuoteItemRequest,
} from "@framerate/contracts";
import { api } from "~/shared/lib/api";

const pageParams = (page: number, pageSize: number) => ({ page: String(page), pageSize: String(pageSize) });

export const quotesService = {
  /** Las cotizaciones del usuario con sesión. */
  getAll: (page = 1, pageSize = 10) => api.get<QuotePage>("/v1/quotes", { params: pageParams(page, pageSize) }),

  /** Las públicas de un usuario. */
  getByUsername: (username: string, page = 1, pageSize = 10) =>
    api.get<QuotePage>(`/v1/quotes/user/${username}`, { params: pageParams(page, pageSize) }),

  create: (data: CreateQuoteRequest) => api.post<QuoteDetail>("/v1/quotes", data),

  getById: (id: string) => api.get<QuoteDetail>(`/v1/quotes/${id}`),

  /** Si el producto ya está, suma a su cantidad. */
  addItem: (quoteId: string, data: AddQuoteItemRequest) => api.post<QuoteDetail>(`/v1/quotes/${quoteId}/items`, data),

  updateItem: (quoteId: string, itemId: number, data: UpdateQuoteItemRequest) =>
    api.patch<QuoteDetail>(`/v1/quotes/${quoteId}/items/${itemId}`, data),

  removeItem: (quoteId: string, itemId: number) => api.delete<QuoteDetail>(`/v1/quotes/${quoteId}/items/${itemId}`),

  // ponytail: PATCH /v1/quotes/:id llega con la entrega 2 de #25. Hoy sólo lo usa el aviso al pegar un link
  // (apagado, ver quote-paste-dialog.tsx).
  setVisibility: (id: string, visibility: QuoteVisibility) =>
    api.patch<QuoteDetail>(`/v1/quotes/${id}`, { visibility }),
};
