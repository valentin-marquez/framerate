import { Logger } from "@framerate/utils";

const logger = new Logger("DiscordWebhook");

const CATEGORY_COLORS: Record<string, number> = {
  privacy: 0x8b5cf6,
  data_request: 0x8b5cf6,
  abuse_report: 0xef4444,
  store_issue: 0xf59e0b,
  bug: 0xf97316,
  feature: 0x10b981,
  other: 0x6b7280,
};

const CATEGORY_LABELS: Record<string, string> = {
  privacy: "Privacidad",
  data_request: "Solicitud de datos",
  abuse_report: "Reporte de abuso",
  store_issue: "Problema con tienda",
  bug: "Bug",
  feature: "Sugerencia",
  other: "Otro",
};

export interface SupportTicketNotification {
  ticketId: string;
  category: string;
  subject: string;
  body: string;
  email: string;
  userId: string | null;
  source: "anonymous" | "authenticated";
}

/**
 * Postea un embed con info del ticket al webhook configurado.
 * No bloquea la respuesta al usuario si falla (best-effort).
 */
export async function notifyNewSupportTicket(
  webhookUrl: string | undefined,
  pingUserId: string | undefined,
  payload: SupportTicketNotification,
): Promise<void> {
  if (!webhookUrl) {
    logger.warn("DISCORD_SUPPORT_WEBHOOK_URL no configurado — saltando notificación.");
    return;
  }

  const color = CATEGORY_COLORS[payload.category] ?? 0x6b7280;
  const categoryLabel = CATEGORY_LABELS[payload.category] ?? payload.category;
  const bodyPreview = payload.body.length > 1000 ? `${payload.body.slice(0, 1000)}…` : payload.body;
  const sourceLabel = payload.source === "anonymous" ? "Anónimo (Turnstile validado)" : "Usuario autenticado";

  const content = pingUserId ? `<@${pingUserId}>` : undefined;

  const embed = {
    title: `🎫 Nuevo ticket: ${payload.subject}`.slice(0, 256),
    color,
    description: bodyPreview,
    fields: [
      { name: "Categoría", value: categoryLabel, inline: true },
      { name: "Origen", value: sourceLabel, inline: true },
      { name: "Email", value: payload.email, inline: false },
      {
        name: "Ticket ID",
        value: `\`${payload.ticketId}\``,
        inline: false,
      },
    ],
    footer: { text: payload.userId ? `user_id: ${payload.userId}` : "sin user_id" },
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        embeds: [embed],
        allowed_mentions: pingUserId ? { users: [pingUserId] } : undefined,
      }),
    });
    if (!res.ok) {
      logger.warn(`Discord webhook returned ${res.status}: ${await res.text()}`);
    }
  } catch (error) {
    logger.error(`Discord webhook failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
