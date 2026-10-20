import type {
  AddQuoteItemRequest,
  CreateQuoteRequest,
  PublicQuote,
  QuoteCondenseOptions,
  QuoteDetail,
  QuoteLike,
  QuotePage,
  UpdateQuoteItemRequest,
  UpdateQuoteRequest,
} from "@framerate/contracts";
import { api } from "~/shared/lib/api";

const pageParams = (page: number, pageSize: number) => ({ page: String(page), pageSize: String(pageSize) });

export const quotesService = {
  /** Las cotizaciones del usuario con sesión. */
  getAll: (page = 1, pageSize = 10) => api.get<QuotePage>("/v1/quotes", { params: pageParams(page, pageSize) }),

  /** Las públicas de un usuario. */
  getByUsername: (username: string, page = 1, pageSize = 10) =>
    api.get<QuotePage>(`/v1/quotes/user/${username}`, { params: pageParams(page, pageSize) }),

  /** Las públicas con más "me gusta" (el inicio). */
  getPublic: (limit = 5, page = 1) =>
    api.get<PublicQuote[]>("/v1/quotes/public", { params: { limit: String(limit), page: String(page) } }),

  like: (id: string) => api.put<QuoteLike>(`/v1/quotes/${id}/like`, {}),

  unlike: (id: string) => api.delete<QuoteLike>(`/v1/quotes/${id}/like`),

  create: (data: CreateQuoteRequest) => api.post<QuoteDetail>("/v1/quotes", data),

  getById: (id: string) => api.get<QuoteDetail>(`/v1/quotes/${id}`),

  /** Opciones para comprar en menos tiendas, una por número de tiendas (sólo el dueño). */
  getCondenseOptions: (id: string) => api.get<QuoteCondenseOptions>(`/v1/quotes/${id}/condense`),

  update: (id: string, data: UpdateQuoteRequest) => api.patch<QuoteDetail>(`/v1/quotes/${id}`, data),

  remove: (id: string) => api.delete<void>(`/v1/quotes/${id}`),

  /** Si el producto ya está, suma a su cantidad. */
  addItem: (quoteId: string, data: AddQuoteItemRequest) => api.post<QuoteDetail>(`/v1/quotes/${quoteId}/items`, data),

  updateItem: (quoteId: string, itemId: number, data: UpdateQuoteItemRequest) =>
    api.patch<QuoteDetail>(`/v1/quotes/${quoteId}/items/${itemId}`, data),

  removeItem: (quoteId: string, itemId: number) => api.delete<QuoteDetail>(`/v1/quotes/${quoteId}/items/${itemId}`),
};
