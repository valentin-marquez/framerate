import type {
  AdminReplyRequest,
  AdminTicket,
  AdminTicketDetail,
  AdminUpdateTicketRequest,
  CreatedTicket,
  CreateTicketRequest,
  ReplyRequest,
  SupportStatus,
  Ticket,
  TicketDetail,
  TicketMessage,
} from "@framerate/contracts";
import { api } from "~/shared/lib/api";

export const SUPPORT_EMAIL = "soporte@framerate.cl";

export const supportClient = {
  create: (payload: CreateTicketRequest) => api.post<CreatedTicket>("/v1/support/tickets", payload),
  listMine: () => api.get<{ items: Ticket[] }>("/v1/support/tickets/mine"),
  get: (id: string, token?: string) =>
    api.get<TicketDetail>(`/v1/support/tickets/${encodeURIComponent(id)}`, token ? { params: { token } } : undefined),
  reply: (id: string, body: string, token?: string) =>
    api.post<TicketMessage>(`/v1/support/tickets/${encodeURIComponent(id)}/reply`, {
      body,
      token,
    } satisfies ReplyRequest),
};

export const adminSupportClient = {
  list: (params: { status?: SupportStatus; limit?: number }) => {
    const q: Record<string, string> = {};
    if (params.status) q.status = params.status;
    if (params.limit) q.limit = String(params.limit);
    return api.get<{ items: AdminTicket[] }>("/v1/admin/support/tickets", { params: q });
  },
  get: (id: string) => api.get<AdminTicketDetail>(`/v1/admin/support/tickets/${encodeURIComponent(id)}`),
  reply: (id: string, body: string, isInternal: boolean) =>
    api.post<TicketMessage>(`/v1/admin/support/tickets/${encodeURIComponent(id)}/reply`, {
      body,
      isInternal,
    } satisfies AdminReplyRequest),
  update: (id: string, body: AdminUpdateTicketRequest) =>
    api.patch<AdminTicket>(`/v1/admin/support/tickets/${encodeURIComponent(id)}`, body),
};
