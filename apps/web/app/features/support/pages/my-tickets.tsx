import {
  IconAlertTriangle,
  IconBug,
  IconBuildingStore,
  IconCheck,
  IconDatabase,
  IconHelp,
  IconLifebuoy,
  IconLoader2,
  IconShieldLock,
  IconSparkles,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { getAuthUser } from "~/features/auth/services/auth.server";
import { Button } from "~/shared/components/primitives/button";
import { Textarea } from "~/shared/components/primitives/textarea";
import { ApiError } from "~/shared/lib/api";
import { cn } from "~/shared/lib/utils";
import {
  type SupportCategory,
  type SupportStatus,
  type SupportTicket,
  type SupportTicketMessage,
  supportClient,
} from "../services/support";
import type { Route } from "./+types/my-tickets";

const CATEGORY_LABELS: Record<SupportCategory, string> = {
  privacy: "Privacidad",
  data_request: "Mis datos",
  abuse_report: "Abuso",
  store_issue: "Tienda",
  bug: "Bug",
  feature: "Sugerencia",
  other: "Otro",
};

const CATEGORY_ICONS: Record<SupportCategory, typeof IconHelp> = {
  privacy: IconShieldLock,
  data_request: IconDatabase,
  abuse_report: IconAlertTriangle,
  store_issue: IconBuildingStore,
  bug: IconBug,
  feature: IconSparkles,
  other: IconHelp,
};

const STATUS_LABELS: Record<SupportStatus, string> = {
  open: "Abierto",
  in_progress: "En curso",
  waiting_user: "Te respondieron",
  resolved: "Resuelto",
  closed: "Cerrado",
};

const STATUS_COLORS: Record<SupportStatus, string> = {
  open: "text-warn bg-warn/10",
  in_progress: "text-primary bg-primary/10",
  waiting_user: "text-primary bg-primary/10",
  resolved: "text-success bg-success/10",
  closed: "text-muted-foreground bg-secondary",
};

const CLOSED_STATUSES = new Set<SupportStatus>(["closed", "resolved"]);

export function meta() {
  return [{ title: "Mis tickets - Framerate" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = await getAuthUser(request);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const { tickets } = await supportClient.listMine(session.access_token);
  return { tickets, token: session.access_token };
}

export default function MyTicketsSettings({ loaderData }: Route.ComponentProps) {
  const { tickets, token } = loaderData;
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
            Todavía no abriste ningún ticket. Podés contactar soporte desde la página de privacidad.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {tickets.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              token={token}
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
  ticket: SupportTicket;
  token: string;
  expanded: boolean;
  onToggle: () => void;
}

function TicketRow({ ticket, token, expanded, onToggle }: TicketRowProps) {
  const Icon = CATEGORY_ICONS[ticket.category];

  return (
    <li className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40 transition-colors cursor-pointer"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{ticket.subject}</p>
          <p className="text-xs text-muted-foreground">
            {CATEGORY_LABELS[ticket.category]} · {new Date(ticket.created_at).toLocaleDateString("es-CL")}
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

      {expanded && <TicketThread ticketId={ticket.id} ticketStatus={ticket.status} token={token} />}
    </li>
  );
}

interface TicketThreadProps {
  ticketId: string;
  ticketStatus: SupportStatus;
  token: string;
}

function TicketThread({ ticketId, ticketStatus, token }: TicketThreadProps) {
  const [loading, setLoading] = useState(true);
  const [ticketBody, setTicketBody] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supportClient
      .get(ticketId, token)
      .then((res) => {
        if (cancelled) return;
        setTicketBody(res.ticket.body);
        setCreatedAt(res.ticket.created_at);
        setMessages(res.messages.filter((m) => !m.is_internal_note));
      })
      .catch((err) => {
        if (!cancelled) {
          setTicketBody(err instanceof ApiError ? `No pudimos cargar el ticket: ${err.message}` : "Error al cargar.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId, token]);

  async function sendReply() {
    if (sending) return;
    const text = reply.trim();
    if (text.length < 1) return;
    setSending(true);
    try {
      const created = await supportClient.reply(ticketId, text, token);
      setMessages((prev) => [...prev, created]);
      setReply("");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No pudimos enviar tu respuesta.";
      setReply((r) => r);
      window.alert(msg);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="border-t border-border/60 p-6 flex justify-center">
        <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canReply = !CLOSED_STATUSES.has(ticketStatus);

  return (
    <div className="border-t border-border/60 bg-background/40">
      <div className="p-4 space-y-3">
        <Bubble authorRole="user" body={ticketBody ?? ""} createdAt={createdAt} isOriginal />
        {messages.map((m) => (
          <Bubble key={m.id} authorRole={m.author_role} body={m.body} createdAt={m.created_at} />
        ))}
      </div>

      {canReply ? (
        <div className="border-t border-border/60 p-4 space-y-2">
          <Textarea
            placeholder="Escribir una respuesta…"
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
      ) : (
        <p className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          Este ticket está {STATUS_LABELS[ticketStatus].toLowerCase()}. Si necesitás algo más, abrí uno nuevo.
        </p>
      )}
    </div>
  );
}

interface BubbleProps {
  authorRole: "user" | "staff" | "system";
  body: string;
  createdAt: string | null;
  isOriginal?: boolean;
}

function Bubble({ authorRole, body, createdAt, isOriginal }: BubbleProps) {
  const isStaff = authorRole === "staff";
  return (
    <div className={cn("flex", isStaff ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "rounded-2xl px-4 py-3 max-w-[85%] border",
          isStaff
            ? "bg-secondary/60 border-border text-foreground"
            : "bg-primary text-primary-foreground border-primary",
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] uppercase tracking-wider font-medium opacity-80">
            {isStaff ? "Soporte" : authorRole === "system" ? "Sistema" : "Vos"}
            {isOriginal && " · consulta"}
          </span>
          {createdAt && <span className="text-[11px] opacity-60">{new Date(createdAt).toLocaleString("es-CL")}</span>}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
