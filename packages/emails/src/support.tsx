import { Block, DEFAULT_BASE_URL, Details, type Email, EmailLayout, Quote } from "./layout";

export type SupportCategory = "privacy" | "data_request" | "abuse_report" | "store_issue" | "bug" | "feature" | "other";
export type SupportStatus = "open" | "in_progress" | "waiting_user" | "resolved" | "closed";

// Las mismas etiquetas que el formulario de soporte de la web.
const CATEGORY_LABEL: Record<SupportCategory, string> = {
  privacy: "Privacidad",
  data_request: "Mis datos",
  abuse_report: "Abuso",
  store_issue: "Tienda",
  bug: "Bug",
  feature: "Sugerencia",
  other: "Otro",
};

const STATUS_LABEL: Record<SupportStatus, string> = {
  open: "Abierto",
  in_progress: "En revisión",
  waiting_user: "Esperando tu respuesta",
  resolved: "Resuelto",
  closed: "Cerrado",
};

/** Cómo sigue el ticket quien lo abrió: con su cuenta, con el enlace de seguimiento o sólo por correo. */
export type TicketChannel = { kind: "account" } | { kind: "anonymous"; trackingUrl: string } | { kind: "email" };

interface TicketEmailProps {
  /** `public_id` del ticket. */
  ticketId: string;
  subject: string;
  channel: TicketChannel;
  baseUrl?: string;
}

const WHY = "Te llega porque abriste un ticket de soporte en Framerate.";
const REPLY_HERE = "Puedes responder este correo: tu respuesta llega al mismo ticket.";

// El asunto no cambia en todo el ticket: así el cliente de correo agrupa el hilo y la respuesta vuelve al ticket (#69).
const ticketSubject = ({ subject, ticketId }: TicketEmailProps) => `${subject} [Framerate #${ticketId}]`;

function followUp({ channel, baseUrl = DEFAULT_BASE_URL }: TicketEmailProps) {
  if (channel.kind === "account") {
    return { action: { label: "Ver el ticket", href: `${baseUrl}/ajustes/tickets` }, note: REPLY_HERE };
  }
  if (channel.kind === "anonymous") {
    return {
      action: { label: "Seguir el ticket", href: channel.trackingUrl },
      note: `Sin cuenta, este enlace es la única forma de ver el ticket: guarda el correo y no lo compartas. ${REPLY_HERE}`,
    };
  }
  return { action: undefined, note: REPLY_HERE };
}

export function ticketReceivedEmail(props: TicketEmailProps & { category: SupportCategory; message: string }): Email {
  const { ticketId, subject, category, message, baseUrl } = props;
  return {
    subject: ticketSubject(props),
    element: (
      <EmailLayout
        card
        baseUrl={baseUrl}
        preview="Recibimos tu mensaje. Te avisamos por aquí cuando te respondamos."
        title="Recibimos tu ticket"
        intro="Gracias por escribirnos. Te avisamos por correo cuando el equipo te responda."
        {...followUp(props)}
        whyReceived={WHY}
      >
        <Block title="Tu mensaje">
          <Quote>{message.length > 600 ? `${message.slice(0, 600).trimEnd()}…` : message}</Quote>
        </Block>
        <Block title="Detalle">
          <Details
            items={[
              ["Ticket", ticketId],
              ["Asunto", subject],
              ["Categoría", CATEGORY_LABEL[category]],
            ]}
          />
        </Block>
      </EmailLayout>
    ),
  };
}

export function ticketReplyEmail(
  props: TicketEmailProps & { staffName: string | null; reply: string; status: SupportStatus },
): Email {
  const { ticketId, subject, staffName, reply, status, baseUrl } = props;
  const who = staffName ? `${staffName}, del equipo de Framerate,` : "El equipo de Framerate";
  return {
    subject: ticketSubject(props),
    element: (
      <EmailLayout
        card
        baseUrl={baseUrl}
        preview={`${staffName ?? "El equipo de Framerate"} respondió tu ticket.`}
        title="Respondimos tu ticket"
        intro={`${who} respondió tu ticket.`}
        {...followUp(props)}
        whyReceived={WHY}
      >
        <Block>
          <Quote>{reply}</Quote>
        </Block>
        <Block title="Detalle">
          <Details
            items={[
              ["Ticket", ticketId],
              ["Asunto", subject],
              ["Estado", STATUS_LABEL[status]],
            ]}
          />
        </Block>
      </EmailLayout>
    ),
  };
}

export function ticketClosedEmail(props: TicketEmailProps & { status: "resolved" | "closed" }): Email {
  const { ticketId, subject, status, baseUrl } = props;
  const resolved = status === "resolved";
  const { action } = followUp(props);
  return {
    subject: ticketSubject(props),
    element: (
      <EmailLayout
        card
        baseUrl={baseUrl}
        preview={resolved ? "Marcamos tu ticket como resuelto." : "Cerramos tu ticket."}
        title={resolved ? "Resolvimos tu ticket" : "Cerramos tu ticket"}
        intro={
          resolved
            ? "Marcamos tu ticket como resuelto. Si el problema sigue, responde este correo y lo reabrimos."
            : "Cerramos tu ticket. Si necesitas algo más, escríbenos y abrimos uno nuevo."
        }
        action={action}
        whyReceived={WHY}
      >
        <Block title="Detalle">
          <Details
            items={[
              ["Ticket", ticketId],
              ["Asunto", subject],
              ["Estado", STATUS_LABEL[status]],
            ]}
          />
        </Block>
      </EmailLayout>
    ),
  };
}
