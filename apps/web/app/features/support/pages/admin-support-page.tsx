import {
  IconAlertTriangle,
  IconBug,
  IconBuildingStore,
  IconCheck,
  IconChecks,
  IconDatabase,
  IconHelp,
  IconLifebuoy,
  IconLoader2,
  IconLock,
  IconLockOpen,
  IconRefresh,
  IconShieldLock,
  IconSparkles,
  IconUserCheck,
} from "@tabler/icons-react";
import { domAnimation, LazyMotion, m, type Transition } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useRevalidator, useSearchParams } from "react-router";
import useMeasure from "react-use-measure";
import { toast } from "sonner";
import { requireAuth, requireRole } from "~/features/auth/services/auth.server";
import { Button } from "~/shared/components/primitives/button";
import { Switch } from "~/shared/components/primitives/switch";
import { Textarea } from "~/shared/components/primitives/textarea";
import { ApiError } from "~/shared/lib/api";
import { cn } from "~/shared/lib/utils";
import {
  adminSupportClient,
  type SupportCategory,
  type SupportStatus,
  type SupportTicketMessage,
} from "../services/support";
import type { Route } from "./+types/admin-support-page";

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
  waiting_user: "Esperando user",
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

const STATUS_FILTERS: Array<SupportStatus | "all"> = [
  "open",
  "in_progress",
  "waiting_user",
  "resolved",
  "closed",
  "all",
];

// Misma curva que el composer de comentarios: el panel anima su alto cuando
// el contenido cambia de tamaño (loading → cargado, cambio de ticket, etc).
const PANEL_RESIZE: Transition = { duration: 0.28, ease: [0.22, 0.61, 0.36, 1] };

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Soporte | Framerate Admin" },
    { name: "description", content: "Bandeja de tickets de soporte." },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const [, { supabase }] = await Promise.all([requireRole(request, "moderator"), requireAuth(request)]);
  // react-doctor-disable-next-line server-sequential-independent-await -- getSession depende del supabase resuelto en el Promise.all anterior
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const token = session.access_token;
  const url = new URL(request.url);
  const statusFilter = (url.searchParams.get("status") as SupportStatus | null) ?? null;

  const { tickets } = await adminSupportClient.list({ status: statusFilter ?? undefined, limit: 100 }, token);

  return { tickets, token, currentUserId: session.user.id };
}

export default function AdminSupportPage({ loaderData }: Route.ComponentProps) {
  const { tickets, token, currentUserId } = loaderData;
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(tickets[0]?.id ?? null);

  // El filtro activo se deriva de la URL — así el resaltado es inmediato y el
  // loader vuelve a correr con el query param correcto.
  const activeFilter: SupportStatus | "all" = (searchParams.get("status") as SupportStatus | null) ?? "all";

  // Cuando cambian los tickets (revalidate o filtro), si el selectedId ya no existe, agarro el primero.
  useEffect(() => {
    if (!selectedId || !tickets.some((t) => t.id === selectedId)) {
      setSelectedId(tickets[0]?.id ?? null);
    }
  }, [tickets, selectedId]);

  function setStatusFilter(next: SupportStatus | "all") {
    setSearchParams(
      (prev) => {
        if (next === "all") prev.delete("status");
        else prev.set("status", next);
        return prev;
      },
      { preventScrollReset: true },
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <header className="mx-auto max-w-7xl mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <IconLifebuoy className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Soporte</h1>
            <p className="text-sm text-muted-foreground">Tickets del formulario integrado.</p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => revalidator.revalidate()}
          disabled={revalidator.state !== "idle"}
        >
          <IconRefresh className={cn("size-4", revalidator.state !== "idle" && "animate-spin")} />
          Refrescar
        </Button>
      </header>

      <nav className="mx-auto max-w-7xl mb-6 flex flex-wrap gap-1 rounded-xl bg-card p-1 border border-border w-fit">
        {STATUS_FILTERS.map((status) => {
          const label = status === "all" ? "Todos" : STATUS_LABELS[status];
          const active = activeFilter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
              )}
            >
              {label}
            </button>
          );
        })}
      </nav>

      <main className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2 border-b border-border bg-secondary/30">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {tickets.length} tickets
            </p>
          </div>
          {tickets.length === 0 ? (
            <div className="p-8 text-center">
              <IconChecks className="mx-auto size-10 text-emerald-500 mb-2" />
              <p className="text-sm text-muted-foreground">Sin tickets en este filtro.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border max-h-[70vh] overflow-y-auto">
              {tickets.map((ticket) => {
                const Icon = CATEGORY_ICONS[ticket.category];
                const isSelected = ticket.id === selectedId;
                return (
                  <li key={ticket.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(ticket.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-secondary/40 transition-colors cursor-pointer",
                        isSelected && "bg-secondary/60",
                      )}
                    >
                      <Icon className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-block rounded-full px-1.5 py-0 text-[10px] font-medium",
                              STATUS_COLORS[ticket.status],
                            )}
                          >
                            {STATUS_LABELS[ticket.status]}
                          </span>
                          {ticket.assigned_to === currentUserId && (
                            <span className="text-[10px] text-primary font-medium">tuyo</span>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate mt-1">{ticket.subject}</p>
                        <p className="text-xs text-muted-foreground truncate">{ticket.email}</p>
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                          {new Date(ticket.last_message_at).toLocaleString("es-CL")}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          {selectedId ? (
            <TicketThread ticketId={selectedId} token={token} currentUserId={currentUserId} />
          ) : (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">Seleccioná un ticket para verlo.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

interface TicketThreadProps {
  ticketId: string;
  token: string;
  currentUserId: string;
}

function TicketThread({ ticketId, token, currentUserId }: TicketThreadProps) {
  const revalidator = useRevalidator();
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<Awaited<ReturnType<typeof adminSupportClient.get>>["ticket"] | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  // Mide el contenido para animar la altura del panel cuando cambia (igual que
  // el composer de comentarios): el cambio entre tickets crece/encoge suave.
  const [contentRef, contentBounds] = useMeasure();
  // Hilo de mensajes: lo bajamos al último mensaje al cargar el ticket y al
  // enviar/recibir uno nuevo.
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminSupportClient
      .get(ticketId, token)
      .then((res) => {
        if (cancelled) return;
        setTicket(res.ticket);
        setMessages(res.messages);
      })
      .catch((err) => {
        const msg = err instanceof ApiError ? err.message : "No pudimos cargar el ticket";
        toast.error(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId, token]);

  // Auto-scroll al último mensaje al cargar el ticket o al sumar uno nuevo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: messages.length basta como disparador
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, ticket?.id]);

  async function sendReply() {
    if (sending) return;
    const text = reply.trim();
    if (text.length < 1) return;
    setSending(true);
    try {
      const created = await adminSupportClient.reply(ticketId, text, isInternal, token);
      setMessages((prev) => [...prev, created]);
      setReply("");
      revalidator.revalidate();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No pudimos enviar la respuesta";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(status: SupportStatus) {
    try {
      const updated = await adminSupportClient.update(ticketId, { status }, token);
      setTicket((prev) => (prev ? { ...prev, status: updated.status } : prev));
      toast.success(`Status actualizado: ${STATUS_LABELS[updated.status]}`);
      revalidator.revalidate();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No pudimos actualizar";
      toast.error(msg);
    }
  }

  async function assignToMe() {
    try {
      await adminSupportClient.update(ticketId, { assign_to_self: true }, token);
      setTicket((prev) => (prev ? { ...prev, assigned_to: currentUserId } : prev));
      toast.success("Asignado a vos");
      revalidator.revalidate();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No pudimos asignar";
      toast.error(msg);
    }
  }

  // Icono con fallback: sólo se usa en la rama con `ticket` non-null.
  const Icon = ticket ? CATEGORY_ICONS[ticket.category] : IconHelp;

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={false}
        animate={{ height: contentBounds.height > 0 ? contentBounds.height : "auto" }}
        transition={PANEL_RESIZE}
        className="relative rounded-2xl border border-border bg-card overflow-hidden"
      >
        <div ref={contentRef}>
          {/* Spinner sutil mientras recarga sin vaciar el panel (stale-while-revalidate). */}
          {loading && ticket && (
            <div className="absolute top-3 right-3 z-10">
              <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!ticket ? (
            <div className="p-12 text-center">
              <IconLoader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className={cn("transition-opacity duration-200", loading && "opacity-50")}>
              <header className="px-6 py-4 border-b border-border space-y-3">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                    <Icon className="size-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_COLORS[ticket.status],
                        )}
                      >
                        {STATUS_LABELS[ticket.status]}
                      </span>
                      <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[ticket.category]}</span>
                      {ticket.source !== "web" && (
                        <span className="text-xs text-muted-foreground">· {ticket.source}</span>
                      )}
                    </div>
                    <h2 className="text-lg font-semibold mt-1">{ticket.subject}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ticket.email}
                      {ticket.user_id ? " · cuenta" : " · anónimo"} ·{" "}
                      {new Date(ticket.created_at).toLocaleString("es-CL")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ticket.assigned_to !== currentUserId && (
                    <Button size="sm" variant="secondary" onClick={assignToMe}>
                      <IconUserCheck className="size-4" /> Asignármelo
                    </Button>
                  )}
                  {ticket.status !== "in_progress" && (
                    <Button size="sm" variant="secondary" onClick={() => changeStatus("in_progress")}>
                      En curso
                    </Button>
                  )}
                  {ticket.status !== "resolved" && (
                    <Button size="sm" variant="secondary" onClick={() => changeStatus("resolved")}>
                      <IconCheck className="size-4" /> Resolver
                    </Button>
                  )}
                  {ticket.status !== "closed" && (
                    <Button size="sm" variant="outline" onClick={() => changeStatus("closed")}>
                      <IconLock className="size-4" /> Cerrar
                    </Button>
                  )}
                  {ticket.status === "closed" && (
                    <Button size="sm" variant="outline" onClick={() => changeStatus("open")}>
                      <IconLockOpen className="size-4" /> Reabrir
                    </Button>
                  )}
                </div>
              </header>

              <div ref={messagesRef} className="thread-scroll px-6 py-4 space-y-4 max-h-[55vh] overflow-y-auto">
                <MessageBubble
                  authorRole="user"
                  body={ticket.body}
                  createdAt={ticket.created_at}
                  isInternalNote={false}
                  isOriginalMessage
                />
                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    authorRole={m.author_role}
                    body={m.body}
                    createdAt={m.created_at}
                    isInternalNote={m.is_internal_note}
                  />
                ))}
              </div>

              <footer className="border-t border-border p-4 space-y-3 bg-secondary/20">
                <Textarea
                  placeholder={isInternal ? "Nota interna (sólo staff)…" : "Escribir respuesta al usuario…"}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  disabled={sending}
                />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <Switch
                      size="sm"
                      checked={isInternal}
                      onCheckedChange={(checked) => setIsInternal(checked)}
                      disabled={sending}
                      aria-label="Marcar como nota interna"
                    />
                    <button
                      type="button"
                      onClick={() => !sending && setIsInternal((v) => !v)}
                      disabled={sending}
                      className={cn(
                        "flex items-center gap-1.5 text-sm cursor-pointer transition-colors",
                        isInternal ? "text-warn font-medium" : "text-muted-foreground",
                      )}
                    >
                      {isInternal && <IconLock className="size-3.5" />}
                      {isInternal ? "Nota interna · no la ve el usuario" : "Nota interna"}
                    </button>
                  </div>
                  <Button size="sm" onClick={sendReply} disabled={sending || reply.trim().length === 0}>
                    {sending ? <IconLoader2 className="size-4 animate-spin" /> : <IconCheck className="size-4" />}
                    {sending ? "Enviando…" : "Enviar"}
                  </Button>
                </div>
              </footer>
            </div>
          )}
        </div>
      </m.div>
    </LazyMotion>
  );
}

interface MessageBubbleProps {
  authorRole: "user" | "staff" | "system";
  body: string;
  createdAt: string;
  isInternalNote: boolean;
  isOriginalMessage?: boolean;
}

function MessageBubble({ authorRole, body, createdAt, isInternalNote, isOriginalMessage }: MessageBubbleProps) {
  const isStaff = authorRole === "staff";
  const timestamp = new Date(createdAt).toLocaleString("es-CL");

  // Nota interna: no es parte de la conversación con el usuario. Se renderiza
  // como un callout a ancho completo, con acento `warn` e icono de candado,
  // bien diferenciado de las burbujas de mensajes.
  if (isInternalNote) {
    return (
      <div className="rounded-xl border border-warn/20 border-l-2 border-l-warn bg-warn/5 px-4 py-3">
        <div className="flex items-center gap-1.5 mb-1">
          <IconLock className="size-3.5 text-warn" />
          <span className="text-[11px] uppercase tracking-wider font-semibold text-warn">Nota interna</span>
          <span className="text-[11px] text-muted-foreground">· sólo staff · {timestamp}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{body}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex", isStaff ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "rounded-2xl px-4 py-3 max-w-[80%] border",
          isStaff
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-secondary/60 border-border text-foreground",
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] uppercase tracking-wider font-medium opacity-80">
            {authorRole === "user" ? "Usuario" : authorRole === "staff" ? "Staff" : "Sistema"}
            {isOriginalMessage && " · original"}
          </span>
          <span className="text-[11px] opacity-60">{timestamp}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
