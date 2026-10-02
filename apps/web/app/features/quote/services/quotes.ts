import { api } from "~/shared/lib/api";
import type { Product } from "~/shared/utils/db-types";

export type ValidationSeverity = "info" | "warning" | "error";

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  componentA?: string;
  componentB?: string;
  details?: string;
}

export interface PerformanceEstimation {
  cpuScore: number;
  gpuScore: number;
  totalScore: number;
  tier: string;
}

export interface BuildAnalysis {
  status: "valid" | "warning" | "incompatible";
  estimatedWattage: number;
  performance?: PerformanceEstimation;
  issues: ValidationIssue[];
}

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
    stock_quantity?: number;
    url: string;
    store: {
      name: string;
      slug: string;
      icon_url: string | null;
    };
  } | null;
  product: Product & {
    prices?: {
      cash: number | null;
      normal: number | null;
    };
  };
  category?: {
    name: string;
    slug: string;
  } | null;
}

export interface VirtualQuoteItem extends QuoteItem {
  virtualId: string;
  isVirtual: boolean;
  originalItem?: QuoteItem;
  indexInGroup?: number;
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
    bio: string | null;
    created_at: string;
  };
}

// ponytail: la API v2 aún no tiene cotizaciones (#25, `0005_quotes.sql`). En false, las lecturas automáticas
// (`useQuotes`, `useQuote`, el pegado de enlaces en comentarios) no salen a la red y la UI las ve vacías. Pasar a
// true cuando exista `/v1/quotes`; crear/editar siguen llamando a la API y fallan con su error.
export const QUOTES_API_ENABLED = false;

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
  getAll: (page = 1, limit = 10) =>
    api.get<QuotesListResponse>("/v1/quotes", {
      params: { page: page.toString(), limit: limit.toString() },
    }),

  /**
   * Obtiene las cotizaciones de un usuario específico por username.
   */
  getByUsername: (username: string, page = 1, limit = 10) =>
    api.get<UserProfileQuotesResponse>(`/v1/quotes/user/${username}`, {
      params: { page: page.toString(), limit: limit.toString() },
    }),

  /**
   * Crea una nueva cotización.
   */
  create: (data: CreateQuoteRequest) => api.post<Quote>("/v1/quotes", data),

  /**
   * Obtiene el detalle completo de una cotización con sus items y precios.
   */
  getById: (id: string) => api.get<QuoteDetail>(`/v1/quotes/${id}`),

  /**
   * Actualiza información de una cotización.
   */
  update: (id: string, data: UpdateQuoteRequest) => api.patch<Quote>(`/v1/quotes/${id}`, data),

  /**
   * Elimina una cotización.
   */
  delete: (id: string) => api.delete<{ success: boolean; message: string }>(`/v1/quotes/${id}`),

  /**
   * Analiza una cotización existente y actualiza el cache en BD.
   */
  analyzeQuote: (id: string) => api.get<BuildAnalysis>(`/v1/quotes/${id}/analyze`),

  /**
   * Agrega un producto a la cotización.
   * Si el producto ya existe, incrementa la cantidad.
   */
  addItem: (quoteId: string, data: AddItemRequest) => api.post<QuoteItem>(`/v1/quotes/${quoteId}/items`, data),

  /**
   * Actualiza la cantidad de un item en la cotización.
   */
  updateItem: (quoteId: string, itemId: string, data: UpdateItemRequest) =>
    api.patch<QuoteItem>(`/v1/quotes/${quoteId}/items/${itemId}`, data),

  /**
   * Elimina un item de la cotización.
   */
  removeItem: (quoteId: string, itemId: string) =>
    api.delete<{ success: boolean; message: string }>(`/v1/quotes/${quoteId}/items/${itemId}`),
};
