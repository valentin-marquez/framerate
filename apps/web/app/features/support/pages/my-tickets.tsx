import type { Ticket, TicketDetail } from "@framerate/contracts";
import { IconLifebuoy, IconLoader2 } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { getAuthUser } from "~/features/auth/services/auth.server";
import { ApiError } from "~/shared/lib/api";
import { cn } from "~/shared/lib/utils";
import { TicketThread } from "../components/ticket-thread";
import { CATEGORY_ICONS, CATEGORY_LABELS, STATUS_COLORS, STATUS_LABELS } from "../lib/labels";
import { supportClient } from "../services/support";
import type { Route } from "./+types/my-tickets";

export function meta() {
  return [{ title: "Mis tickets - Framerate" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getAuthUser(request);
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const { items } = await supportClient.listMine();
  return { tickets: items };
}

export default function MyTicketsSettings({ loaderData }: Route.ComponentProps) {
  const { tickets } = loaderData;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium tracking-tight">Mis tickets</h2>
        <p className="text-sm text-muted-foreground">Tus consultas a soporte y las respuestas del equipo.</p>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
          <IconLifebuoy className="mx-auto size-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Todavía no abriste ningún ticket. Puedes contactar a soporte desde la página de privacidad.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {tickets.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              expanded={selectedId === ticket.id}
              onToggle={() => setSelectedId((prev) => (prev === ticket.id ? null : ticket.id))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface TicketRowProps {
  ticket: Ticket;
  expanded: boolean;
  onToggle: () => void;
}

function TicketRow({ ticket, expanded, onToggle }: TicketRowProps) {
  const Icon = CATEGORY_ICONS[ticket.category];

  return (
    <li className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40 transition-colors cursor-pointer"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{ticket.subject}</p>
          <p className="flex gap-3 text-xs text-muted-foreground">
            <span>{CATEGORY_LABELS[ticket.category]}</span>
            <span>{new Date(ticket.createdAt).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })}</span>
          </p>
        </div>
        <span
          className={cn(
            "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0",
            STATUS_COLORS[ticket.status],
          )}
        >
          {STATUS_LABELS[ticket.status]}
        </span>
      </button>

      {expanded && <TicketDetailPanel ticketId={ticket.id} />}
    </li>
  );
}

function TicketDetailPanel({ ticketId }: { ticketId: string }) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supportClient
      .get(ticketId)
      .then((res) => {
        if (!cancelled) setTicket(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "No pudimos cargar el ticket.");
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  return (
    <div className="border-t border-border/60">
      {ticket ? (
        <TicketThread ticket={ticket} />
      ) : error ? (
        <p className="p-4 text-sm text-muted-foreground">{error}</p>
      ) : (
        <div className="flex justify-center p-6">
          <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
