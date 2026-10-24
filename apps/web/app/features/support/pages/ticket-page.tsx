import { IconLifebuoy } from "@tabler/icons-react";
import { Link } from "react-router";
import { ApiError } from "~/shared/lib/api";
import { cn } from "~/shared/lib/utils";
import { TicketThread } from "../components/ticket-thread";
import { CATEGORY_ICONS, CATEGORY_LABELS, STATUS_COLORS, STATUS_LABELS } from "../lib/labels";
import { SUPPORT_EMAIL, supportClient } from "../services/support";
import type { Route } from "./+types/ticket-page";

export function meta() {
  return [
    { title: "Ticket de soporte - Framerate" },
    { name: "robots", content: "noindex, nofollow" },
    // El token va en la URL: que no viaje como Referer a enlaces externos.
    { name: "referrer", content: "no-referrer" },
  ];
}

export async function loader({ request, params, url }: Route.LoaderArgs) {
  const token = url.searchParams.get("t") ?? undefined;
  try {
    return { ticket: await supportClient.get(params.id, token), token };
  } catch (err) {
    // Sin token válido la API no distingue "no existe" de "no es tuyo".
    if (err instanceof ApiError && [401, 403, 404].includes(err.status)) return { ticket: null, token };
    throw err;
  }
}

export default function TicketPage({ loaderData }: Route.ComponentProps) {
  const { ticket, token } = loaderData;

  if (!ticket) {
    return (
      <div className="container mx-auto max-w-3xl px-6 py-12 lg:py-20">
        <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
          <IconLifebuoy className="mx-auto mb-2 size-8 text-muted-foreground" />
          <h1 className="font-semibold text-lg">No encontramos este ticket o el enlace no es válido</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Revisa que el enlace esté completo. Si el problema sigue, escríbenos a{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-foreground underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex h-9 items-center justify-center rounded-xl bg-secondary px-4 font-medium text-secondary-foreground text-sm transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  const Icon = CATEGORY_ICONS[ticket.category];

  return (
    <div className="container mx-auto max-w-3xl px-6 py-12 lg:py-20">
      <header className="mb-8 space-y-3">
        <p className="text-muted-foreground text-sm">Ticket de soporte</p>
        <h1 className="text-title-h4">{ticket.subject}</h1>
        <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Icon className="size-4" />
            {CATEGORY_LABELS[ticket.category]}
          </span>
          <span className={cn("rounded-full px-2 py-0.5 font-medium text-xs", STATUS_COLORS[ticket.status])}>
            {STATUS_LABELS[ticket.status]}
          </span>
          <code className="text-xs">{ticket.id}</code>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <TicketThread key={ticket.id} ticket={ticket} token={token} />
      </div>
    </div>
  );
}
