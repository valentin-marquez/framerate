import type { BuildAnalysis, ValidationIssue } from "@framerate/db";
import { api } from "../lib/api";
import type { Product } from "./products";

// Quote types
export interface Quote {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  compatibility_status: "valid" | "warning" | "incompatible" | "unknown";
  estimated_wattage: number | null;
  validation_errors: ValidationIssue[] | null;
  last_analyzed_at: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface QuoteListItem extends Omit<Quote, "validation_errors" | "user_id"> {
  quote_items: [{ count: number }];
}

export interface QuoteItem {
  id: string;
  quantity: number;
  created_at: string;
  listing_id?: string | null;
  selected_listing?: {
    id: string;
    price_normal: number | null;
    price_cash: number | null;
    url: string;
    store: {
      name: string;
      logo_url: string | null;
      slug: string;
    };
  } | null;
  product: Product & {
    prices?: {
      cash: number | null;
      normal: number | null;
    };
  };
}

export interface QuoteDetail extends Quote {
  items: QuoteItem[];
  totals: {
    cash: number;
    normal: number;
  };
}

export interface QuotesListResponse {
  data: QuoteListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateQuoteRequest {
  name: string;
  description?: string;
  is_public?: boolean;
}

export interface UpdateQuoteRequest {
  name?: string;
  description?: string;
  is_public?: boolean;
}

export interface AddItemRequest {
  product_id: string;
  quantity?: number;
  listing_id?: string;
}

export interface UpdateItemRequest {
  quantity?: number;
  listing_id?: string | null;
}

export interface AnalyzeBuildRequest {
  productIds: string[];
}

export interface UserProfileQuotesResponse extends QuotesListResponse {
  user: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    created_at: string;
  };
}

/**
 * Service para interactuar con el sistema de cotizaciones.
 */
export const quotesService = {
  /**
   * Analiza la compatibilidad de un conjunto de productos (sin autenticación).
   * Útil para validación en tiempo real antes de crear una cotización.
   */
  analyze: (productIds: string[]) => api.post<BuildAnalysis>("/v1/quotes/analyze", { productIds }),

  /**
   * Obtiene todas las cotizaciones del usuario autenticado.
   */
  getAll: (page = 1, limit = 10, token?: string) =>
    api.get<QuotesListResponse>("/v1/quotes", {
      params: { page: page.toString(), limit: limit.toString() },
      token,
    }),

  /**
   * Obtiene las cotizaciones de un usuario específico por username.
   */
  getByUsername: (username: string, page = 1, limit = 10, token?: string) =>
    api.get<UserProfileQuotesResponse>(`/v1/quotes/user/${username}`, {
      params: { page: page.toString(), limit: limit.toString() },
      token,
    }),

  /**
   * Crea una nueva cotización.
   */
  create: (data: CreateQuoteRequest, token?: string) => api.post<Quote>("/v1/quotes", data, { token }),

  /**
   * Obtiene el detalle completo de una cotización con sus items y precios.
   */
  getById: (id: string, token?: string) => api.get<QuoteDetail>(`/v1/quotes/${id}`, { token }),

  /**
   * Actualiza información de una cotización.
   */
  update: (id: string, data: UpdateQuoteRequest, token?: string) =>
    api.patch<Quote>(`/v1/quotes/${id}`, data, { token }),

  /**
   * Elimina una cotización.
   */
  delete: (id: string, token?: string) =>
    api.delete<{ success: boolean; message: string }>(`/v1/quotes/${id}`, { token }),

  /**
   * Analiza una cotización existente y actualiza el cache en BD.
   */
  analyzeQuote: (id: string, token?: string) => api.get<BuildAnalysis>(`/v1/quotes/${id}/analyze`, { token }),

  /**
   * Agrega un producto a la cotización.
   * Si el producto ya existe, incrementa la cantidad.
   */
  addItem: (quoteId: string, data: AddItemRequest, token?: string) =>
    api.post<QuoteItem>(`/v1/quotes/${quoteId}/items`, data, { token }),

  /**
   * Actualiza la cantidad de un item en la cotización.
   */
  updateItem: (quoteId: string, itemId: string, data: UpdateItemRequest, token?: string) =>
    api.patch<QuoteItem>(`/v1/quotes/${quoteId}/items/${itemId}`, data, { token }),

  /**
   * Elimina un item de la cotización.
   */
  removeItem: (quoteId: string, itemId: string, token?: string) =>
    api.delete<{ success: boolean; message: string }>(`/v1/quotes/${quoteId}/items/${itemId}`, { token }),
};
