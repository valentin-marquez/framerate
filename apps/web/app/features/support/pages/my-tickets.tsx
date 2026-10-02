import type { TicketDetail } from "@framerate/contracts";
import { IconLoader2 } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { getAuthUser } from "~/features/auth/services/auth.server";
import { ApiError } from "~/shared/lib/api";
import { MyTickets } from "../components/my-tickets";
import { TicketThread } from "../components/ticket-thread";
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
  return (
    <MyTickets tickets={loaderData.tickets} renderThread={(ticket) => <TicketDetailPanel ticketId={ticket.id} />} />
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

  if (ticket) return <TicketThread ticket={ticket} />;
  if (error) return <p className="p-4 text-sm text-muted-foreground">{error}</p>;
  return (
    <div className="flex justify-center p-6">
      <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}
