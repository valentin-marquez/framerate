import { IconChecks, IconLoader2, IconRefresh, IconShieldCheck, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { toast } from "sonner";
import { requireAuth, requireRole } from "~/features/auth/services/auth.server";
import { Button } from "~/shared/components/primitives/button";
import { Textarea } from "~/shared/components/primitives/textarea";
import { ApiError } from "~/shared/lib/api";
import { cn } from "~/shared/lib/utils";
import type { ModAction, QueueItem } from "../services/moderation";
import { moderationClient } from "../services/moderation";
import type { Report } from "../services/reports";
import type { Route } from "./+types/moderation-dashboard";

const REASON_LABELS: Record<Report["reason"], string> = {
  spam: "Spam",
  harassment: "Acoso",
  misleading: "Enganoso",
  duplicate: "Duplicado",
  wrong_listing: "Listing incorrecto",
  broken_link: "Link roto",
  inappropriate: "Inapropiado",
  other: "Otro",
};

const STATUS_LABELS: Record<Report["status"], string> = {
  open: "Abierto",
  reviewing: "En revision",
  resolved: "Resuelto",
  dismissed: "Descartado",
};

const STATUS_COLORS: Record<Report["status"], string> = {
  open: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
  reviewing: "text-blue-600 bg-blue-50 dark:bg-blue-950/40",
  resolved: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
  dismissed: "text-muted-foreground bg-secondary",
};

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Moderation | Framerate Admin" },
    { name: "description", content: "Moderation dashboard for Framerate" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "moderator");
  const { supabase } = await requireAuth(request);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const token = session.access_token;

  // Cargamos en paralelo: queue item, lista de reports y mod actions.
  const [queueRes, reportsRes, actionsRes] = await Promise.allSettled([
    moderationClient.getQueueItem(token),
    moderationClient.listReports({ limit: 50 }, token),
    moderationClient.listModActions({ limit: 50 }, token),
  ]);

  const queueItem = queueRes.status === "fulfilled" ? queueRes.value.item : null;
  const reports = reportsRes.status === "fulfilled" ? reportsRes.value.reports : [];
  const actions = actionsRes.status === "fulfilled" ? actionsRes.value.actions : [];

  return { queueItem, reports, actions, token };
}

type TabKey = "queue" | "reports" | "actions";

export default function ModerationDashboard({ loaderData }: Route.ComponentProps) {
  const { queueItem, reports, actions, token } = loaderData;
  const [tab, setTab] = useState<TabKey>("queue");
  const revalidator = useRevalidator();

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <header className="mx-auto max-w-6xl mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <IconShieldCheck className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Moderacion</h1>
            <p className="text-sm text-muted-foreground">Cola de reports, audit log y acciones rapidas.</p>
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

      <nav className="mx-auto max-w-6xl mb-6 flex gap-1 rounded-xl bg-card p-1 border border-border w-fit">
        <TabButton active={tab === "queue"} onClick={() => setTab("queue")}>
          Queue {queueItem ? <span className="ml-1 rounded-full bg-amber-500 size-2 inline-block" /> : null}
        </TabButton>
        <TabButton active={tab === "reports"} onClick={() => setTab("reports")}>
          Reports ({reports.length})
        </TabButton>
        <TabButton active={tab === "actions"} onClick={() => setTab("actions")}>
          Audit log
        </TabButton>
      </nav>

      <main className="mx-auto max-w-6xl">
        {tab === "queue" ? <QueueTab item={queueItem} token={token} /> : null}
        {tab === "reports" ? <ReportsTab reports={reports} /> : null}
        {tab === "actions" ? <ActionsTab actions={actions} /> : null}
      </main>
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

function QueueTab({ item, token }: { item: QueueItem | null; token: string }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"resolved" | "dismissed" | "reviewing" | null>(null);
  const revalidator = useRevalidator();

  if (!item) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 flex flex-col items-center justify-center text-center">
        <IconChecks className="size-12 text-emerald-500 mb-3" />
        <h2 className="text-xl font-semibold">Nada pendiente en la cola</h2>
        <p className="text-sm text-muted-foreground mt-1">Cuando llegue un nuevo report aparecera aca.</p>
      </div>
    );
  }

  async function decide(decision: "resolved" | "dismissed" | "reviewing") {
    setBusy(decision);
    try {
      // item es non-null en este branch (early return arriba).
      const current = item;
      if (!current) return;
      await moderationClient.resolve(
        {
          msg_id: current.msg_id,
          report_id: current.report_id,
          decision,
          note: note.trim() ? note.trim() : undefined,
        },
        token,
      );
      toast.success(`Report ${decision}`);
      setNote("");
      revalidator.revalidate();
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : "Error resolviendo";
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", STATUS_COLORS[item.status])}>
            {STATUS_LABELS[item.status]}
          </span>
          <h2 className="text-xl font-semibold mt-2">
            {item.target_type.toUpperCase()} · {REASON_LABELS[item.reason]}
          </h2>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            target_id: {item.target_id} · report_id: {item.report_id}
          </p>
        </div>
      </div>

      {item.details ? (
        <div className="rounded-xl bg-secondary/50 p-4 mb-4">
          <p className="text-xs uppercase text-muted-foreground mb-1">Detalles del reporter</p>
          <p className="text-sm whitespace-pre-wrap">{item.details}</p>
        </div>
      ) : null}

      <div className="rounded-xl bg-secondary/30 p-4 mb-4">
        <p className="text-xs uppercase text-muted-foreground mb-2">Target snapshot</p>
        <pre className="text-xs overflow-x-auto max-h-64 font-mono">
          {JSON.stringify(item.target_snapshot, null, 2)}
        </pre>
      </div>

      <div className="flex flex-col gap-3">
        <Textarea
          placeholder="Nota interna (opcional, queda en el audit log)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="secondary" disabled={!!busy} onClick={() => decide("reviewing")}>
            {busy === "reviewing" ? <IconLoader2 className="size-4 animate-spin" /> : null}
            Postponer
          </Button>
          <Button variant="destructive" disabled={!!busy} onClick={() => decide("dismissed")}>
            {busy === "dismissed" ? <IconLoader2 className="size-4 animate-spin" /> : <IconX className="size-4" />}
            Descartar
          </Button>
          <Button disabled={!!busy} onClick={() => decide("resolved")}>
            {busy === "resolved" ? <IconLoader2 className="size-4 animate-spin" /> : <IconChecks className="size-4" />}
            Resolver
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReportsTab({ reports }: { reports: Report[] }) {
  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
        Sin reports todavia.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2">Target</th>
            <th className="text-left px-4 py-2">Motivo</th>
            <th className="text-left px-4 py-2">Status</th>
            <th className="text-left px-4 py-2">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="px-4 py-2">
                <div className="font-medium">{r.target_type}</div>
                <div className="text-xs text-muted-foreground font-mono">{r.target_id.slice(0, 8)}...</div>
              </td>
              <td className="px-4 py-2">{REASON_LABELS[r.reason]}</td>
              <td className="px-4 py-2">
                <span
                  className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", STATUS_COLORS[r.status])}
                >
                  {STATUS_LABELS[r.status]}
                </span>
              </td>
              <td className="px-4 py-2 text-muted-foreground text-xs">{new Date(r.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionsTab({ actions }: { actions: ModAction[] }) {
  if (actions.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
        Sin acciones registradas.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2">Accion</th>
            <th className="text-left px-4 py-2">Target</th>
            <th className="text-left px-4 py-2">Actor</th>
            <th className="text-left px-4 py-2">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a) => (
            <tr key={a.id} className="border-t border-border">
              <td className="px-4 py-2 font-medium">{a.action}</td>
              <td className="px-4 py-2">
                <div className="font-mono text-xs">{a.target_type}</div>
                <div className="font-mono text-xs text-muted-foreground">{a.target_id?.slice(0, 8) ?? "—"}</div>
              </td>
              <td className="px-4 py-2 font-mono text-xs">{a.actor_id?.slice(0, 8) ?? "—"}</td>
              <td className="px-4 py-2 text-muted-foreground text-xs">{new Date(a.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
