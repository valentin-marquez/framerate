import type { Ticket, TicketDetail } from "@framerate/contracts";
import { IconChevronDown, IconLifebuoy } from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router";
import { SettingsGroup, SettingsRow, SettingsSection } from "~/features/settings/components/settings-parts";
import { buttonVariants } from "~/shared/components/primitives/button";
import { cn } from "~/shared/lib/utils";
import { CATEGORY_ICONS, CATEGORY_LABELS, STATUS_COLORS, STATUS_LABELS } from "../../lib/labels";
import { TicketThread } from "../ticket-thread";

const ACTIVE = new Set<Ticket["status"]>(["waiting_user", "open", "in_progress"]);
// "Te respondieron" primero: es lo único que espera algo de la persona.
const byUrgency = (a: Ticket, b: Ticket) =>
  Number(b.status === "waiting_user") - Number(a.status === "waiting_user") ||
  b.lastMessageAt.localeCompare(a.lastMessageAt);

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" });

/**
 * /ajustes/tickets con las piezas de Ajustes (secciones y grupos): los tickets en curso arriba, los cerrados aparte y
 * el acceso a soporte al final. La conversación se abre dentro de la fila, como hoy.
 */
export function MyTickets({ tickets, threads = {} }: { tickets: Ticket[]; threads?: Record<string, TicketDetail> }) {
  const [openId, setOpenId] = useState<string | null>(Object.keys(threads)[0] ?? null);
  const active = tickets.filter((t) => ACTIVE.has(t.status)).toSorted(byUrgency);
  const closed = tickets.filter((t) => !ACTIVE.has(t.status)).toSorted(byUrgency);
  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-8">
      {tickets.length === 0 ? (
        <SettingsSection title="Mis tickets" description="Tus consultas a soporte y las respuestas del equipo.">
          <SettingsGroup>
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <IconLifebuoy className="size-6 text-muted-foreground" stroke={1.5} />
              <p className="font-medium text-foreground">No tienes tickets</p>
              <p className="max-w-sm text-muted-foreground text-sm">
                Si algo no funciona o tienes una duda, escríbenos y te respondemos por correo.
              </p>
            </div>
          </SettingsGroup>
        </SettingsSection>
      ) : (
        <>
          {active.length > 0 && (
            <SettingsSection title="En curso" description="Te avisamos por correo cuando el equipo responde.">
              <TicketGroup tickets={active} openId={openId} threads={threads} onToggle={toggle} />
            </SettingsSection>
          )}
          {closed.length > 0 && (
            <SettingsSection title="Cerrados" description="Si respondes uno resuelto, lo volvemos a abrir.">
              <TicketGroup tickets={closed} openId={openId} threads={threads} onToggle={toggle} />
            </SettingsSection>
          )}
        </>
      )}

      <SettingsGroup>
        <SettingsRow
          icon={IconLifebuoy}
          title="¿Necesitas algo más?"
          description="Abre un ticket nuevo: te respondemos por correo y queda en esta lista."
          action={
            <Link to="/privacidad#contacto" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Escribir a soporte
            </Link>
          }
        />
      </SettingsGroup>
    </div>
  );
}

function TicketGroup({
  tickets,
  openId,
  threads,
  onToggle,
}: {
  tickets: Ticket[];
  openId: string | null;
  threads: Record<string, TicketDetail>;
  onToggle: (id: string) => void;
}) {
  return (
    <SettingsGroup>
      {tickets.map((t) => {
        const Icon = CATEGORY_ICONS[t.category];
        const open = openId === t.id;
        const thread = threads[t.id];
        return (
          <div key={t.id}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => onToggle(t.id)}
              className="flex w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/40 sm:px-5"
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" stroke={1.75} />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium text-foreground">{t.subject}</span>
                  <span className={cn("rounded-md px-1.5 py-0.5 font-medium text-[11px]", STATUS_COLORS[t.status])}>
                    {STATUS_LABELS[t.status]}
                  </span>
                </p>
                <p className="flex flex-wrap gap-x-3 text-muted-foreground text-xs">
                  <span>{CATEGORY_LABELS[t.category]}</span>
                  <span className="font-mono">{t.id}</span>
                  <span>Último mensaje el {day(t.lastMessageAt)}</span>
                </p>
              </div>
              <IconChevronDown
                className={cn(
                  "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>
            {open && (
              <div className="border-border border-t">
                {thread ? (
                  <TicketThread ticket={thread} />
                ) : (
                  <p className="px-5 py-4 text-muted-foreground text-sm">Cargando la conversación…</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </SettingsGroup>
  );
}
