import type { Ticket } from "@framerate/contracts";
import { IconArrowLeft, IconChevronRight, IconLifebuoy } from "@tabler/icons-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router";
import { SettingsGroup, SettingsRow, SettingsSection } from "~/features/settings/components/settings-parts";
import { buttonVariants } from "~/shared/components/primitives/button";
import { cn } from "~/shared/lib/utils";
import { CATEGORY_ICONS, CATEGORY_LABELS, STATUS_COLORS, STATUS_LABELS } from "../lib/labels";

/** Cómo se arma la lista: etiquetas discretas, un solo listado con filtro, o el estado a la derecha de cada fila. */
export type TicketsVariant = "quieta" | "filtro" | "estado";

const ACTIVE = new Set<Ticket["status"]>(["waiting_user", "open", "in_progress"]);
// "Te respondieron" primero: es lo único que espera algo de la persona.
const byUrgency = (a: Ticket, b: Ticket) =>
  Number(b.status === "waiting_user") - Number(a.status === "waiting_user") ||
  b.lastMessageAt.localeCompare(a.lastMessageAt);

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" });

/**
 * /ajustes/tickets: la lista a la izquierda y la conversación a la derecha. En escritorio siempre hay un ticket
 * abierto: el que espera respuesta o, si no, el de movimiento más reciente. En teléfono se entra por la lista y el
 * chat ocupa la pantalla, con "Mis tickets" para volver.
 */
export function MyTickets({
  tickets,
  renderThread,
  initial = null,
  variant = "quieta",
}: {
  tickets: Ticket[];
  /** La conversación de un ticket: la página la carga al elegirlo. */
  renderThread: (ticket: Ticket) => ReactNode;
  initial?: string | null;
  variant?: TicketsVariant;
}) {
  const [selected, setSelected] = useState<string | null>(initial);
  const active = tickets.filter((t) => ACTIVE.has(t.status)).toSorted(byUrgency);
  const closed = tickets.filter((t) => !ACTIVE.has(t.status)).toSorted(byUrgency);
  const [tab, setTab] = useState<"active" | "closed">(active.length > 0 ? "active" : "closed");
  // `selected` sólo lo fija quien elige; sin él, escritorio muestra el primero y teléfono la lista.
  const visible = variant === "filtro" ? (tab === "active" ? active : closed) : [...active, ...closed];
  const shown = visible.find((t) => t.id === selected) ?? visible[0];
  const pick = (id: string) => setSelected(id);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className={cn("space-y-6", selected && "hidden lg:block")}>
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
        ) : variant === "filtro" ? (
          <div className="space-y-3">
            <fieldset className="m-0 flex min-w-0 gap-1 rounded-2xl border-0 bg-secondary p-1">
              <legend className="sr-only">Filtrar tickets</legend>
              {(
                [
                  ["active", "En curso", active.length],
                  ["closed", "Cerrados", closed.length],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={tab === key}
                  onClick={() => {
                    setTab(key);
                    setSelected(null);
                  }}
                  className={cn(
                    "flex-1 cursor-pointer rounded-xl px-3 py-1.5 font-medium text-sm transition-colors",
                    tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label} <span className="tabular-nums opacity-60">{count}</span>
                </button>
              ))}
            </fieldset>
            <TicketGroup tickets={visible} shownId={shown?.id} onPick={pick} variant={variant} />
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <TicketGroup
                tickets={active}
                shownId={shown?.id}
                onPick={pick}
                variant={variant}
                label="En curso"
                hint="Te avisamos por correo cuando el equipo responde."
              />
            )}
            {closed.length > 0 && (
              <TicketGroup
                tickets={closed}
                shownId={shown?.id}
                onPick={pick}
                variant={variant}
                label="Cerrados"
                hint="Si respondes uno resuelto, lo volvemos a abrir."
              />
            )}
          </>
        )}
      </div>

      {shown && (
        <div className={cn(!selected && "hidden lg:block", "lg:sticky lg:top-24")}>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground lg:hidden"
          >
            <IconArrowLeft className="size-4" />
            Mis tickets
          </button>
          {/* `key` reinicia la conversación (respuesta a medias, mensajes) al cambiar de ticket. */}
          <div
            key={shown.id}
            className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card lg:min-h-[34rem]"
          >
            <header className="space-y-2 border-border border-b px-4 py-4 sm:px-5 sm:py-5">
              <h2 className="font-semibold text-foreground text-xl leading-snug tracking-tight">{shown.subject}</h2>
              <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-muted-foreground text-xs">
                <StatusBadge status={shown.status} />
                <span>{CATEGORY_LABELS[shown.category]}</span>
                <span className="font-mono">{shown.id}</span>
              </p>
            </header>
            <div className="flex flex-1 flex-col">{renderThread(shown)}</div>
          </div>
        </div>
      )}

      <div className={cn("lg:col-span-2", selected && "hidden lg:block")}>
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
    </div>
  );
}

function TicketGroup({
  tickets,
  shownId,
  onPick,
  variant,
  label,
  hint,
}: {
  tickets: Ticket[];
  shownId?: string;
  onPick: (id: string) => void;
  variant: TicketsVariant;
  /** Cabecera del grupo dentro de la tarjeta: así el primer ticket y el chat quedan a la misma altura. */
  label?: string;
  hint?: string;
}) {
  return (
    <SettingsGroup>
      {label && (
        <div className="px-4 py-3">
          <h2 className="flex items-baseline gap-2 font-medium text-foreground text-sm">
            {label}
            <span className="font-normal text-muted-foreground tabular-nums">{tickets.length}</span>
          </h2>
          {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
        </div>
      )}
      {tickets.map((t) => {
        const Icon = CATEGORY_ICONS[t.category];
        return (
          <button
            key={t.id}
            type="button"
            aria-current={shownId === t.id}
            onClick={() => onPick(t.id)}
            className={cn(
              "flex w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/40",
              shownId === t.id && "lg:bg-secondary/70",
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" stroke={1.75} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="line-clamp-2 font-medium text-foreground leading-snug">{t.subject}</p>
              {variant === "estado" ? (
                <p className="text-muted-foreground text-xs">{CATEGORY_LABELS[t.category]}</p>
              ) : (
                <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-muted-foreground text-xs">
                  <StatusBadge status={t.status} />
                  <span>{CATEGORY_LABELS[t.category]}</span>
                  <span>{day(t.lastMessageAt)}</span>
                </p>
              )}
            </div>
            {variant === "estado" ? (
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <StatusBadge status={t.status} />
                <span className="text-muted-foreground text-xs">{day(t.lastMessageAt)}</span>
              </div>
            ) : (
              <IconChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground lg:hidden" />
            )}
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
