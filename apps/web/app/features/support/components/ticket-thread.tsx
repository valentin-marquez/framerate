import type { TicketDetail, TicketMessage } from "@framerate/contracts";
import { IconCheck, IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { toast } from "sonner";
import { Button } from "~/shared/components/primitives/button";
import { Textarea } from "~/shared/components/primitives/textarea";
import { ApiError } from "~/shared/lib/api";
import { cn } from "~/shared/lib/utils";
import { formatDateTime } from "~/shared/utils/format";
import { supportClient } from "../services/support";

interface TicketThreadProps {
  ticket: TicketDetail;
  /** Sin sesión: el token del enlace de seguimiento. */
  token?: string;
}

/** Hilo de un ticket visto por quien lo abrió: mensajes y caja de respuesta. */
export function TicketThread({ ticket, token }: TicketThreadProps) {
  const revalidator = useRevalidator();
  const [messages, setMessages] = useState<TicketMessage[]>(ticket.messages);
  const [status, setStatus] = useState(ticket.status);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  async function sendReply() {
    const text = reply.trim();
    if (sending || !text) return;
    setSending(true);
    try {
      const created = await supportClient.reply(ticket.id, text, token);
      setMessages((prev) => [...prev, created]);
      setReply("");
      // Responder puede reabrir el ticket: la página vuelve a pedir el estado.
      revalidator.revalidate();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setStatus("closed");
      toast.error(err instanceof ApiError ? err.message : "No pudimos enviar tu respuesta.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-background/40">
      <div className="flex-1 space-y-3 p-3 sm:p-4">
        {messages.map((m, i) => (
          <Bubble key={m.id} message={m} isFirst={i === 0} />
        ))}
      </div>

      {status === "closed" ? (
        <p className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          Este ticket está cerrado. Si necesitas algo más, abre uno nuevo.
        </p>
      ) : (
        <div className="space-y-2 border-t border-border/60 p-4">
          <Textarea
            aria-label="Respuesta"
            placeholder={
              status === "resolved" ? "Si necesitas algo más, escribe aquí y lo reabrimos…" : "Escribe una respuesta…"
            }
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            disabled={sending}
            maxLength={5000}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={sendReply} disabled={sending || reply.trim().length === 0}>
              {sending ? <IconLoader2 className="size-4 animate-spin" /> : <IconCheck className="size-4" />}
              {sending ? "Enviando…" : "Responder"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({ message, isFirst }: { message: TicketMessage; isFirst: boolean }) {
  const isStaff = message.authorRole === "staff";
  return (
    <div className={cn("flex", isStaff ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl border px-3.5 py-3 sm:max-w-[85%] sm:px-4",
          isStaff
            ? "border-border bg-secondary/60 text-foreground"
            : "border-primary bg-primary text-primary-foreground",
        )}
      >
        <div className="mb-1 flex flex-wrap items-center gap-x-2">
          <span className="font-medium text-[11px] uppercase tracking-wider opacity-80">
            {isStaff ? "Soporte" : message.authorRole === "system" ? "Sistema" : "Tú"}
            {isFirst && <span className="ml-2 opacity-70">consulta</span>}
          </span>
          {/* Zona fija: la página de seguimiento se renderiza en el servidor (UTC) y no debe cambiar al hidratar. */}
          <span className="whitespace-nowrap text-[11px] opacity-60">{formatDateTime(message.createdAt)}</span>
        </div>
        {/* Texto claro sobre fondo oscuro se ve más fino de lo que es: un peso más en la burbuja propia. */}
        <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", !isStaff && "font-medium")}>{message.body}</p>
      </div>
    </div>
  );
}
