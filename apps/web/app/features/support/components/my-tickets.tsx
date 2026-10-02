import type { Ticket } from "@framerate/contracts";
import { IconArrowLeft, IconChevronRight, IconLifebuoy } from "@tabler/icons-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router";
import { SettingsGroup, SettingsRow, SettingsSection } from "~/features/settings/components/settings-parts";
import { buttonVariants } from "~/shared/components/primitives/button";
import { cn } from "~/shared/lib/utils";
import { CATEGORY_ICONS, CATEGORY_LABELS, STATUS_COLORS, STATUS_LABELS } from "../lib/labels";

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
 * /ajustes/tickets: la lista a la izquierda (en curso arriba, cerrados aparte) y la conversación a la derecha. En
 * escritorio siempre hay un ticket abierto: el que espera respuesta o, si no, el de movimiento más reciente. En
 * teléfono se entra por la lista y el chat ocupa la pantalla, con "Mis tickets" para volver.
 */
export function MyTickets({
  tickets,
  renderThread,
  initial = null,
}: {
  tickets: Ticket[];
  /** La conversación de un ticket: la página la carga al elegirlo. */
  renderThread: (ticket: Ticket) => ReactNode;
  initial?: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(initial);
  const active = tickets.filter((t) => ACTIVE.has(t.status)).toSorted(byUrgency);
  const closed = tickets.filter((t) => !ACTIVE.has(t.status)).toSorted(byUrgency);
  // `selected` sólo lo fija quien elige; sin él, escritorio muestra el primero y teléfono la lista.
  const shown = tickets.find((t) => t.id === selected) ?? active[0] ?? closed[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className={cn("space-y-8", selected && "hidden lg:block")}>
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
                <TicketGroup tickets={active} shownId={shown?.id} onPick={setSelected} />
              </SettingsSection>
            )}
            {closed.length > 0 && (
              <SettingsSection title="Cerrados" description="Si respondes uno resuelto, lo volvemos a abrir.">
                <TicketGroup tickets={closed} shownId={shown?.id} onPick={setSelected} />
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

      {shown && (
        <div className={cn(!selected && "hidden lg:block")}>
          <div key={shown.id} className={cn("space-y-4 lg:sticky lg:top-24", ENTER)}>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="inline-flex cursor-pointer items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground lg:hidden"
            >
              <IconArrowLeft className="size-4" />
              Mis tickets
            </button>
            <div className="overflow-hidden rounded-3xl border border-border bg-card">
              <header className="space-y-1.5 border-border border-b px-4 py-4 sm:px-5">
                <h2 className="font-semibold text-base text-foreground leading-snug">{shown.subject}</h2>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
                  <StatusBadge status={shown.status} />
                  <span>{CATEGORY_LABELS[shown.category]}</span>
                  <span className="font-mono">{shown.id}</span>
                </p>
              </header>
              {renderThread(shown)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TicketGroup({
  tickets,
  shownId,
  onPick,
}: {
  tickets: Ticket[];
  shownId?: string;
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
            aria-current={shownId === t.id}
            onClick={() => onPick(t.id)}
            className={cn(
              "flex w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/40 sm:px-5",
              shownId === t.id && "lg:bg-secondary/60",
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

const StatusBadge = ({ status }: { status: Ticket["status"] }) => (
  <span className={cn("rounded-md px-1.5 py-0.5 font-medium text-[11px]", STATUS_COLORS[status])}>
    {STATUS_LABELS[status]}
  </span>
);
