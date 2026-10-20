import type {
  AdminTicket,
  AdminTicketDetail,
  Health,
  SupportStatus,
  TeamMember,
  TicketMessage,
} from "@framerate/contracts";
import { IconCheck, IconChecks, IconHelp, IconLoader2, IconLock, IconMail, IconRefresh } from "@tabler/icons-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useRevalidator, useSearchParams } from "react-router";
import { toast } from "sonner";
import { requireRole } from "~/features/auth/services/auth.server";
import { AdminTabs } from "~/shared/components/layout/admin-tabs";
import { Button } from "~/shared/components/primitives/button";
import { Label } from "~/shared/components/primitives/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/shared/components/primitives/select";
import { Switch } from "~/shared/components/primitives/switch";
import { Textarea } from "~/shared/components/primitives/textarea";
import { ApiError, api } from "~/shared/lib/api";
import { cn } from "~/shared/lib/utils";
import { formatDateTime } from "~/shared/utils/format";
import { StatusStrip } from "../components/status-strip";
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  STATUS_COLORS,
  ticketSource,
  STATUS_LABELS as USER_STATUS_LABELS,
} from "../lib/labels";
import { adminSupportClient } from "../services/support";
import type { Route } from "./+types/admin-support-page";

const STATUS_LABELS: Record<SupportStatus, string> = { ...USER_STATUS_LABELS, waiting_user: "Esperando respuesta" };

type View = "mine" | "unassigned" | "open" | "waiting_user" | "done";

const isDone = (t: AdminTicket) => t.status === "resolved" || t.status === "closed";

const VIEWS: { key: View; label: string; test: (t: AdminTicket, me: string) => boolean }[] = [
  { key: "mine", label: "Mis tickets", test: (t, me) => t.assignedTo === me && !isDone(t) },
  { key: "unassigned", label: "Sin asignar", test: (t) => t.assignedTo === null && !isDone(t) },
  { key: "open", label: "Abiertos", test: (t) => t.status === "open" || t.status === "in_progress" },
  { key: "waiting_user", label: "Esperando", test: (t) => t.status === "waiting_user" },
  { key: "done", label: "Cerrados", test: isDone },
];

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Soporte - Framerate Admin" },
    { name: "description", content: "Bandeja de tickets de soporte." },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireRole(request, "support");
  // ponytail: las vistas se cuentan en la web sobre los últimos 200; con más volumen, contarlas en la API.
  const [{ items }, { items: team }, incidents] = await Promise.all([
    adminSupportClient.list({ limit: 200 }),
    adminSupportClient.team(),
    // Sin el estado la bandeja sigue sirviendo: la franja simplemente no sale.
    api
      .get<Health>("/v1/admin/health")
      .then((h) => h.incidents)
      .catch(() => null),
  ]);
  return { tickets: items, team, incidents, currentUserId: user.id };
}

export default function AdminSupportPage({ loaderData }: Route.ComponentProps) {
  const { tickets, team, incidents, currentUserId } = loaderData;
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();
  const view = VIEWS.find((v) => v.key === searchParams.get("vista")) ?? VIEWS[1];
  const visible = tickets.filter((t) => view.test(t, currentUserId));
  const [selectedId, setSelectedId] = useState<string | null>(visible[0]?.id ?? null);

  // Al cambiar de vista se abre el primero. Asignar o cambiar el estado puede sacar al ticket abierto de la vista: sigue
  // abierto igual, para no saltar a otro en medio del trabajo.
  useEffect(() => {
    setSelectedId((current) => (current && tickets.some((t) => t.id === current) ? current : (visible[0]?.id ?? null)));
  }, [tickets, visible]);
  const [lastView, setLastView] = useState(view.key);
  if (lastView !== view.key) {
    setLastView(view.key);
    setSelectedId(visible[0]?.id ?? null);
  }

  const nameOf = (id: string) => (id === currentUserId ? "ti" : (team.find((m) => m.id === id)?.displayName ?? "otro"));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
      <AdminTabs current="/admin/support" />
      <header className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-title-h4 md:text-title-h3">Soporte</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => revalidator.revalidate()}
            disabled={revalidator.state !== "idle"}
          >
            <IconRefresh className={cn("size-4", revalidator.state !== "idle" && "animate-spin")} />
            Actualizar
          </Button>
        </div>
        {incidents && <StatusStrip incidents={incidents} />}
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[340px_1fr]">
        <section className="min-w-0 space-y-3">
          <nav aria-label="Vistas" className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
            {VIEWS.map((v) => (
              <Link
                key={v.key}
                to={v.key === "unassigned" ? "." : `?vista=${v.key}`}
                preventScrollReset
                replace
                aria-current={view.key === v.key ? "true" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-sm transition-colors",
                  view.key === v.key
                    ? "bg-foreground text-background"
                    : "bg-secondary/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {v.label}
                <span className="tabular-nums opacity-70">
                  {tickets.filter((t) => v.test(t, currentUserId)).length}
                </span>
              </Link>
            ))}
          </nav>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {visible.length === 0 ? (
              <div className="p-8 text-center">
                <IconChecks className="mx-auto mb-2 size-10 text-success" />
                <p className="text-muted-foreground text-sm">Nada en esta vista.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border max-h-[70vh] overflow-y-auto">
                {visible.map((ticket) => {
                  const Icon = CATEGORY_ICONS[ticket.category];
                  const source = ticketSource(ticket.source);
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
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <source.Icon className="size-3" aria-hidden />
                              {source.label}
                            </span>
                            {ticket.assignedTo && (
                              <span className="text-[10px] text-muted-foreground">
                                para {nameOf(ticket.assignedTo)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium truncate mt-1">{ticket.subject}</p>
                          <p className="text-xs text-muted-foreground truncate" title={ticket.email}>
                            {ticket.email}
                          </p>
                          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                            {formatDateTime(ticket.lastMessageAt)}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="min-w-0">
          {selectedId ? (
            <TicketThread key={selectedId} ticketId={selectedId} team={team} currentUserId={currentUserId} />
          ) : (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">Selecciona un ticket para verlo.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

interface TicketThreadProps {
  ticketId: string;
  team: TeamMember[];
  currentUserId: string;
}

function TicketThread({ ticketId, team, currentUserId }: TicketThreadProps) {
  const revalidator = useRevalidator();
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<AdminTicketDetail | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  // Hilo de mensajes: lo bajamos al último mensaje al cargar el ticket y al
  // enviar/recibir uno nuevo.
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminSupportClient
      .get(ticketId)
      .then((res) => {
        if (cancelled) return;
        setTicket(res);
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
  }, [ticketId]);

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
      const created = await adminSupportClient.reply(ticketId, text, isInternal);
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

  async function update(change: { status: SupportStatus } | { assignedTo: string | null }) {
    try {
      const updated = await adminSupportClient.update(ticketId, change);
      setTicket((prev) => (prev ? { ...prev, status: updated.status, assignedTo: updated.assignedTo } : prev));
      toast.success(
        "status" in change
          ? `Estado: ${STATUS_LABELS[updated.status]}`
          : updated.assignedTo
            ? `Asignado a ${updated.assignedTo === currentUserId ? "ti" : team.find((m) => m.id === updated.assignedTo)?.displayName}`
            : "Sin asignar",
      );
      revalidator.revalidate();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No pudimos actualizar";
      toast.error(msg);
    }
  }

  // Icono con fallback: sólo se usa en la rama con `ticket` non-null.
  const Icon = ticket ? CATEGORY_ICONS[ticket.category] : IconHelp;
  const source = ticketSource(ticket?.source ?? "");
  const replyHintId = useId();

  return (
    <div className="relative rounded-2xl border border-border bg-card overflow-hidden">
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
        <div className={cn("transition-opacity", loading && "opacity-50")}>
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
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <source.Icon className="size-3.5" aria-hidden />
                    {source.label}
                  </span>
                </div>
                <h2 className="text-lg font-semibold mt-1">{ticket.subject}</h2>
                <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-0.5">
                  <span className="break-all text-foreground">{ticket.email}</span>
                  <span>{ticket.userId ? "Con cuenta" : "Sin cuenta"}</span>
                  <span>{formatDateTime(ticket.createdAt)}</span>
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`${replyHintId}-assignee`} className="text-muted-foreground text-xs">
                  Asignado a
                </Label>
                <Select
                  value={ticket.assignedTo ?? "none"}
                  onValueChange={(v) => update({ assignedTo: v === "none" ? null : (v as string) })}
                >
                  <SelectTrigger id={`${replyHintId}-assignee`} size="sm" className="w-full">
                    <SelectValue>
                      {(v: string) =>
                        v === "none" ? "Sin asignar" : (team.find((m) => m.id === v)?.displayName ?? "Fuera del equipo")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {team.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.id === currentUserId ? `${m.displayName} (tú)` : m.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${replyHintId}-status`} className="text-muted-foreground text-xs">
                  Estado
                </Label>
                <Select value={ticket.status} onValueChange={(v) => update({ status: v as SupportStatus })}>
                  <SelectTrigger id={`${replyHintId}-status`} size="sm" className="w-full">
                    <SelectValue>{(v: string) => STATUS_LABELS[v as SupportStatus]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as SupportStatus[]).map((st) => (
                      <SelectItem key={st} value={st}>
                        {STATUS_LABELS[st]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </header>

          <div ref={messagesRef} className="scrollbar-slim px-6 py-4 space-y-4 max-h-[55vh] overflow-y-auto">
            {messages.map((m, i) => (
              <MessageBubble
                key={m.id}
                authorRole={m.authorRole}
                body={m.body}
                createdAt={m.createdAt}
                isInternalNote={m.isInternal}
                isOriginalMessage={i === 0}
              />
            ))}
          </div>

          <footer className="border-t border-border p-4 space-y-3 bg-secondary/20">
            <Textarea
              placeholder={isInternal ? "Escribe una nota interna…" : "Escribe una respuesta…"}
              aria-describedby={replyHintId}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              disabled={sending}
            />
            <p id={replyHintId} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              {isInternal ? (
                <>
                  <IconLock className="size-3.5 shrink-0 mt-px text-warn" aria-hidden />
                  Sólo la ve el equipo, no se envía por correo
                </>
              ) : (
                <>
                  <IconMail className="size-3.5 shrink-0 mt-px" aria-hidden />
                  <span className="min-w-0">
                    Se envía por correo a <span className="break-all font-medium text-foreground">{ticket.email}</span>
                  </span>
                </>
              )}
            </p>
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
                    isInternal ? "text-warn-ink font-medium" : "text-muted-foreground",
                  )}
                >
                  Nota interna
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
  const timestamp = formatDateTime(createdAt);

  // Nota interna: no es parte de la conversación con el usuario. Se renderiza
  // como un callout a ancho completo, con acento `warn` e icono de candado,
  // bien diferenciado de las burbujas de mensajes.
  if (isInternalNote) {
    return (
      <div className="rounded-xl border border-warn/20 border-l-2 border-l-warn bg-warn/5 px-4 py-3">
        <div className="flex items-center gap-1.5 mb-1">
          <IconLock className="size-3.5 text-warn-ink" />
          <span className="text-[11px] uppercase tracking-wider font-semibold text-warn-ink">Nota interna</span>
          <span className="text-[11px] text-muted-foreground">Sólo el equipo</span>
          <span className="text-[11px] text-muted-foreground">{timestamp}</span>
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
            {authorRole === "user" ? "Usuario" : authorRole === "staff" ? "Equipo" : "Sistema"}
            {isOriginalMessage && <span className="ml-2 opacity-70">consulta</span>}
          </span>
          <span className="text-[11px] opacity-60">{timestamp}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
