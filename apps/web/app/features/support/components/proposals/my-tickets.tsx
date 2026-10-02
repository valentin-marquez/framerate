import type { Ticket, TicketDetail } from "@framerate/contracts";
import { IconArrowLeft, IconChevronRight, IconLifebuoy, IconMessages, IconMinus, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router";
import { SettingsGroup, SettingsRow, SettingsSection } from "~/features/settings/components/settings-parts";
import { buttonVariants } from "~/shared/components/primitives/button";
import { cn } from "~/shared/lib/utils";
import { CATEGORY_ICONS, CATEGORY_LABELS, STATUS_COLORS, STATUS_LABELS } from "../../lib/labels";
import { TicketThread } from "../ticket-thread";

/** Cómo se ve la conversación de un ticket: bandeja de dos paneles, página propia o chat acoplado abajo. */
export type TicketsVariant = "bandeja" | "pagina" | "dock";

const ACTIVE = new Set<Ticket["status"]>(["waiting_user", "open", "in_progress"]);
// "Te respondieron" primero: es lo único que espera algo de la persona.
const byUrgency = (a: Ticket, b: Ticket) =>
  Number(b.status === "waiting_user") - Number(a.status === "waiting_user") ||
  b.lastMessageAt.localeCompare(a.lastMessageAt);

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" });

const ENTER =
  "animate-in fade-in-0 duration-base ease-out fill-mode-forwards slide-in-from-right-4 motion-reduce:animate-none";

/**
 * /ajustes/tickets con las piezas de Ajustes. Los tickets en curso arriba, los cerrados aparte y el acceso a soporte
 * al final; lo que cambia entre variantes es dónde se lee la conversación (nada de modales).
 */
export function MyTickets({
  tickets,
  threads = {},
  variant = "bandeja",
  initial = null,
}: {
  tickets: Ticket[];
  threads?: Record<string, TicketDetail>;
  variant?: TicketsVariant;
  initial?: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(initial);
  const [minimized, setMinimized] = useState(false);
  const current = tickets.find((t) => t.id === selected) ?? null;
  const pick = (id: string) => {
    setSelected(id);
    setMinimized(false);
  };
  const close = () => setSelected(null);
  const chat = current && <TicketChat ticket={current} thread={threads[current.id]} />;

  const lists = <TicketLists tickets={tickets} selectedId={selected} onPick={pick} />;

  if (variant === "pagina") {
    return (
      <div className="mx-auto max-w-3xl">
        {current ? (
          <div key={current.id} className={cn("space-y-4", ENTER)}>
            <BackButton onClick={close} />
            <Panel>{chat}</Panel>
          </div>
        ) : (
          lists
        )}
      </div>
    );
  }

  if (variant === "dock") {
    return (
      <div className="mx-auto max-w-3xl">
        {lists}
        {current && (
          <aside
            key={current.id}
            aria-label={`Conversación: ${current.subject}`}
            className="fixed inset-x-3 bottom-3 z-40 overflow-hidden rounded-2xl border border-border bg-card shadow-xl animate-in fade-in-0 slide-in-from-bottom-4 duration-base ease-out fill-mode-forwards motion-reduce:animate-none sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[26rem]"
          >
            <header className="flex items-center gap-2 border-border border-b px-4 py-2.5">
              <button
                type="button"
                onClick={() => setMinimized((m) => !m)}
                className="min-w-0 flex-1 cursor-pointer text-left"
                aria-expanded={!minimized}
              >
                <span className="block truncate font-medium text-foreground text-sm">{current.subject}</span>
                <StatusBadge status={current.status} />
              </button>
              <IconButton label="Minimizar" onClick={() => setMinimized((m) => !m)}>
                <IconMinus className="size-4" />
              </IconButton>
              <IconButton label="Cerrar conversación" onClick={close}>
                <IconX className="size-4" />
              </IconButton>
            </header>
            {!minimized && (
              <div className="max-h-[60dvh] overflow-y-auto">
                {threads[current.id] ? (
                  <TicketThread ticket={threads[current.id]} />
                ) : (
                  <p className="px-5 py-4 text-muted-foreground text-sm">Cargando la conversación…</p>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    );
  }

  // bandeja: lista y conversación lado a lado; en teléfono, una a la vez.
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className={cn(current && "hidden lg:block")}>{lists}</div>
      <div className={cn(!current && "hidden lg:block")}>
        {current ? (
          <div key={current.id} className={cn("space-y-4 lg:sticky lg:top-24", ENTER)}>
            <BackButton onClick={close} className="lg:hidden" />
            <Panel>{chat}</Panel>
          </div>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-3xl border border-border border-dashed text-center text-muted-foreground">
            <IconMessages className="size-6" stroke={1.5} />
            <p className="text-sm">Elige un ticket para ver la conversación</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TicketLists({
  tickets,
  selectedId,
  onPick,
}: {
  tickets: Ticket[];
  selectedId: string | null;
  onPick: (id: string) => void;
}) {
  const active = tickets.filter((t) => ACTIVE.has(t.status)).toSorted(byUrgency);
  const closed = tickets.filter((t) => !ACTIVE.has(t.status)).toSorted(byUrgency);

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
              <TicketGroup tickets={active} selectedId={selectedId} onPick={onPick} />
            </SettingsSection>
          )}
          {closed.length > 0 && (
            <SettingsSection title="Cerrados" description="Si respondes uno resuelto, lo volvemos a abrir.">
              <TicketGroup tickets={closed} selectedId={selectedId} onPick={onPick} />
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
  selectedId,
  onPick,
}: {
  tickets: Ticket[];
  selectedId: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <SettingsGroup>
      {tickets.map((t) => {
        const Icon = CATEGORY_ICONS[t.category];
        return (
          <button
            key={t.id}
            type="button"
            aria-current={selectedId === t.id}
            onClick={() => onPick(t.id)}
            className={cn(
              "flex w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/40 sm:px-5",
              selectedId === t.id && "bg-secondary/60",
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" stroke={1.75} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-foreground">{t.subject}</span>
                <StatusBadge status={t.status} />
              </p>
              <p className="flex flex-wrap gap-x-3 text-muted-foreground text-xs">
                <span>{CATEGORY_LABELS[t.category]}</span>
                <span className="font-mono">{t.id}</span>
                <span>Último mensaje el {day(t.lastMessageAt)}</span>
              </p>
            </div>
            <IconChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          </button>
        );
      })}
    </SettingsGroup>
  );
}

function TicketChat({ ticket, thread }: { ticket: Ticket; thread?: TicketDetail }) {
  return (
    <>
      <header className="space-y-1.5 border-border border-b px-4 py-4 sm:px-5">
        <h2 className="font-semibold text-base text-foreground leading-snug">{ticket.subject}</h2>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
          <StatusBadge status={ticket.status} />
          <span>{CATEGORY_LABELS[ticket.category]}</span>
          <span className="font-mono">{ticket.id}</span>
        </p>
      </header>
      {thread ? (
        <TicketThread ticket={thread} />
      ) : (
        <p className="px-5 py-4 text-muted-foreground text-sm">Cargando la conversación…</p>
      )}
    </>
  );
}

const Panel = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-hidden rounded-3xl border border-border bg-card">{children}</div>
);

const StatusBadge = ({ status }: { status: Ticket["status"] }) => (
  <span className={cn("rounded-md px-1.5 py-0.5 font-medium text-[11px]", STATUS_COLORS[status])}>
    {STATUS_LABELS[status]}
  </span>
);

const BackButton = ({ onClick, className }: { onClick: () => void; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex cursor-pointer items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground",
      className,
    )}
  >
    <IconArrowLeft className="size-4" />
    Mis tickets
  </button>
);

const IconButton = ({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
  >
    {children}
  </button>
);
