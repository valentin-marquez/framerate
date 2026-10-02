import { z } from "zod";

/**
 * Soporte: tickets con hilo de mensajes (`/v1/support/*` para quien escribe, `/v1/admin/support/*` para el
 * personal). El primer mensaje del ticket es un mensaje más. Quien escribe sin cuenta recibe una vez un token
 * (`accessToken`) que da acceso a su ticket; en la base sólo queda su hash.
 */

export const SUPPORT_CATEGORIES = [
  "privacy",
  "data_request",
  "abuse_report",
  "store_issue",
  "bug",
  "feature",
  "other",
] as const;
export const SupportCategorySchema = z.enum(SUPPORT_CATEGORIES);
export type SupportCategory = z.infer<typeof SupportCategorySchema>;

export const SUPPORT_STATUSES = ["open", "in_progress", "waiting_user", "resolved", "closed"] as const;
export const SupportStatusSchema = z.enum(SUPPORT_STATUSES);
export type SupportStatus = z.infer<typeof SupportStatusSchema>;

const MessageBodySchema = z.string().trim().min(1).max(5000);

export const CreateTicketRequestSchema = z.object({
  category: SupportCategorySchema,
  subject: z.string().trim().min(3).max(200),
  body: MessageBodySchema,
  /** Sólo sin sesión: a dónde responder. Con sesión se usa el correo de la cuenta. */
  email: z.email().max(320).optional(),
  /** Sólo sin sesión: token del widget de Turnstile. */
  turnstileToken: z.string().min(1).max(2048).optional(),
});
export type CreateTicketRequest = z.infer<typeof CreateTicketRequestSchema>;

export const TicketMessageSchema = z.object({
  id: z.number().int(),
  authorRole: z.enum(["user", "staff", "system"]),
  body: z.string(),
  /** Nota interna del personal: nunca llega a quien abrió el ticket. */
  isInternal: z.boolean(),
  createdAt: z.string(),
});
export type TicketMessage = z.infer<typeof TicketMessageSchema>;

export const TicketSchema = z.object({
  /** `public_id`: lo que ve la persona y lo que va en el asunto de los correos. */
  id: z.string(),
  category: SupportCategorySchema,
  subject: z.string(),
  status: SupportStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  lastMessageAt: z.string(),
});
export type Ticket = z.infer<typeof TicketSchema>;

export const TicketDetailSchema = TicketSchema.extend({ messages: z.array(TicketMessageSchema) });
export type TicketDetail = z.infer<typeof TicketDetailSchema>;

/** Respuesta de crear: `accessToken` sólo sin sesión, y es la única vez que viaja. */
export const CreatedTicketSchema = TicketSchema.extend({ accessToken: z.string().nullable() });
export type CreatedTicket = z.infer<typeof CreatedTicketSchema>;

/** Responder: sin sesión, con el token del ticket. */
export const ReplyRequestSchema = z.object({ body: MessageBodySchema, token: z.string().min(1).max(256).optional() });
export type ReplyRequest = z.infer<typeof ReplyRequestSchema>;

export const AdminTicketSchema = TicketSchema.extend({
  email: z.string(),
  userId: z.string().nullable(),
  assignedTo: z.string().nullable(),
  source: z.string(),
});
export type AdminTicket = z.infer<typeof AdminTicketSchema>;

export const AdminTicketDetailSchema = AdminTicketSchema.extend({ messages: z.array(TicketMessageSchema) });
export type AdminTicketDetail = z.infer<typeof AdminTicketDetailSchema>;

export const AdminReplyRequestSchema = z.object({ body: MessageBodySchema, isInternal: z.boolean().default(false) });
export type AdminReplyRequest = z.infer<typeof AdminReplyRequestSchema>;

export const AdminUpdateTicketRequestSchema = z.object({
  status: SupportStatusSchema.optional(),
  assignToSelf: z.boolean().optional(),
});
export type AdminUpdateTicketRequest = z.infer<typeof AdminUpdateTicketRequestSchema>;
