import type { TicketMessage } from "@framerate/contracts";
import { cn } from "~/shared/lib/utils";
import { formatDateTime } from "~/shared/utils/format";

const GROUP_MS = 5 * 60_000;

/**
 * Burbujas con los metadatos fuera (21st.dev, "Message With Header And Delivery Status" y "Chat Bubble Thread"): el
 * nombre y la hora del equipo van en una línea sobre su primera burbuja, la hora de lo propio va debajo y los mensajes
 * seguidos de la misma persona (menos de 5 minutos) comparten encabezado.
 */
export function TicketBubbles({ messages }: { messages: TicketMessage[] }) {
  return (
    <ul className="space-y-1 p-3 sm:p-4">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const mine = m.authorRole === "user";
        const sameAsPrev =
          prev && prev.authorRole === m.authorRole && +new Date(m.createdAt) - +new Date(prev.createdAt) < GROUP_MS;
        const sameAsNext =
          next && next.authorRole === m.authorRole && +new Date(next.createdAt) - +new Date(m.createdAt) < GROUP_MS;
        const who = mine ? "Tú" : m.authorRole === "staff" ? "Soporte" : "Sistema";

        return (
          <li key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start", !sameAsPrev && "pt-3")}>
            {!sameAsPrev && !mine && (
              <p className="mb-1 flex gap-x-2 px-1 text-muted-foreground text-xs">
                <span className="font-medium text-foreground">{who}</span>
                <span>{formatDateTime(m.createdAt)}</span>
              </p>
            )}
            {!sameAsPrev && mine && i === 0 && <p className="mb-1 px-1 text-muted-foreground text-xs">Tu consulta</p>}
            <p
              className={cn(
                "max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[85%] sm:px-4",
                mine
                  ? "bg-primary font-medium text-primary-foreground"
                  : "border border-border bg-secondary/60 text-foreground",
              )}
            >
              {m.body}
            </p>
            {mine && !sameAsNext && (
              <p className="mt-1 px-1 text-muted-foreground text-xs">{formatDateTime(m.createdAt)}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
