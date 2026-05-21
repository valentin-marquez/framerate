import { api } from "~/shared/lib/api";

export type SupportCategory = "privacy" | "data_request" | "abuse_report" | "store_issue" | "bug" | "feature" | "other";

export type SupportStatus = "open" | "in_progress" | "waiting_user" | "resolved" | "closed";

export interface SupportTicket {
  id: string;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  created_at: string;
  updated_at?: string;
  last_message_at?: string;
}

export interface SupportTicketDetail extends SupportTicket {
  user_id: string | null;
  body: string;
}

export interface SupportTicketMessage {
  id: string;
  author_id: string | null;
  author_role: "user" | "staff" | "system";
  body: string;
  is_internal_note: boolean;
  created_at: string;
}

export interface CreateTicketPayload {
  category: SupportCategory;
  subject: string;
  body: string;
  /** Sólo para anon: el email del visitante. */
  email?: string;
  /** Sólo para anon: token del widget Turnstile. */
  turnstile_token?: string;
}

export interface CreatedTicket {
  id: string;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  created_at?: string;
}

export const supportClient = {
  create: (payload: CreateTicketPayload, token?: string) =>
    api.post<CreatedTicket>("/v1/support/tickets", payload, token ? { token } : undefined),
  listMine: (token: string) => api.get<{ tickets: SupportTicket[] }>("/v1/support/tickets/mine", { token }),
  get: (id: string, token: string) =>
    api.get<{ ticket: SupportTicketDetail; messages: SupportTicketMessage[] }>(`/v1/support/tickets/${id}`, { token }),
  reply: (id: string, body: string, token: string) =>
    api.post<SupportTicketMessage>(`/v1/support/tickets/${id}/reply`, { body }, { token }),
};

export const adminSupportClient = {
  list: (params: { status?: SupportStatus; limit?: number }, token: string) => {
    const q: Record<string, string> = {};
    if (params.status) q.status = params.status;
    if (params.limit) q.limit = String(params.limit);
    return api.get<{
      tickets: Array<{
        id: string;
        user_id: string | null;
        email: string;
        category: SupportCategory;
        subject: string;
        status: SupportStatus;
        assigned_to: string | null;
        source: string;
        created_at: string;
        updated_at: string;
        last_message_at: string;
      }>;
    }>("/v1/admin/support/tickets", { token, params: q });
  },
  get: (id: string, token: string) =>
    api.get<{
      ticket: SupportTicketDetail & { email: string; assigned_to: string | null; source: string };
      messages: SupportTicketMessage[];
    }>(`/v1/admin/support/tickets/${id}`, { token }),
  reply: (id: string, body: string, isInternalNote: boolean, token: string) =>
    api.post<SupportTicketMessage>(
      `/v1/admin/support/tickets/${id}/reply`,
      { body, is_internal_note: isInternalNote },
      { token },
    ),
  update: (id: string, body: { status?: SupportStatus; assign_to_self?: boolean }, token: string) =>
    api.patch<{ id: string; status: SupportStatus; assigned_to: string | null; updated_at: string }>(
      `/v1/admin/support/tickets/${id}`,
      body,
      { token },
    ),
};
