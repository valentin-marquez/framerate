import {
  type ModerationAction,
  REPORT_RESOLUTIONS,
  type Report,
  type ReportResolution,
  type ReportStatus,
} from "@framerate/contracts";
import { IconCircleCheck, IconLoader2, IconRefresh } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, useRevalidator, useSearchParams } from "react-router";
import { toast } from "sonner";
import { requireRole } from "~/features/auth/services/auth.server";
import { AdminTabs } from "~/shared/components/layout/admin-tabs";
import { Button } from "~/shared/components/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/shared/components/primitives/dialog";
import { Label } from "~/shared/components/primitives/label";
import { Textarea } from "~/shared/components/primitives/textarea";
import { ApiError } from "~/shared/lib/api";
import { cn } from "~/shared/lib/utils";
import { formatDateTime } from "~/shared/utils/format";
import { moderationClient } from "../services/moderation";
import { REASON_LABELS, TARGET_LABELS } from "../services/reports";
import type { Route } from "./+types/moderation-dashboard";

const PAGE_SIZE = 25;

const STATUS_LABELS: Record<ReportStatus, string> = {
  open: "Abierto",
  reviewing: "En revisión",
  resolved: "Resuelto",
  dismissed: "Descartado",
};

const RESOLUTION_LABELS: Record<ReportResolution, string> = {
  no_action: "Sin acción (descartar)",
  content_removed: "Contenido eliminado",
  user_banned: "Usuario sancionado",
  listing_fixed: "Oferta corregida",
  duplicate_of_other: "Duplicado de otro reporte",
};

const VIEWS = [
  { id: "cola", label: "Cola" },
  { id: "reportes", label: "Todos los reportes" },
  { id: "historial", label: "Bitácora" },
] as const;
type View = (typeof VIEWS)[number]["id"];

export function meta(_: Route.MetaArgs) {
  return [{ title: "Moderación - Framerate Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request, url }: Route.LoaderArgs) {
  await requireRole(request, "moderator");
  const params = url.searchParams;
  const view: View = VIEWS.find((v) => v.id === params.get("vista"))?.id ?? "cola";
  const page = Math.max(1, Number(params.get("pagina")) || 1);
  const args = { page, pageSize: PAGE_SIZE };

  if (view === "historial") return { view, reports: null, actions: await moderationClient.listActions(args) };
  const reports = await (view === "cola" ? moderationClient.queue(args) : moderationClient.listReports(args));
  return { view, reports, actions: null };
}

function viewUrl(params: URLSearchParams, change: Record<string, string | null>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(change)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  return query ? `?${query}` : ".";
}

function Chip({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      replace
      aria-current={active ? "true" : undefined}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-foreground text-background" : "bg-secondary/60 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function claimedNow(report: Report) {
  return report.claimedBy && report.claimedUntil && new Date(report.claimedUntil).getTime() > Date.now()
    ? report.claimedBy
    : null;
}

function ReportRow({ report, onOpen }: { report: Report; onOpen: () => void }) {
  const claimer = claimedNow(report);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="grid w-full grid-cols-[1fr_auto] items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
      >
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">
            {TARGET_LABELS[report.targetType]} <span className="font-mono text-xs">{report.targetId}</span>
          </p>
          <p className="text-sm text-muted-foreground">{REASON_LABELS[report.reason]}</p>
          <p className="text-xs text-muted-foreground">
            {report.reporter ? `@${report.reporter.username}` : "Usuario eliminado"}, {formatDateTime(report.createdAt)}
            {report.targetReportCount > 1 && `, ${report.targetReportCount} reportes sobre lo mismo`}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{STATUS_LABELS[report.status]}</p>
          {claimer && <p>Lo tiene @{claimer.username}</p>}
        </div>
      </button>
    </li>
  );
}

function Pager({ params, page, total }: { params: URLSearchParams; page: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages === 1) return null;
  return (
    <nav className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
      <span className="tabular-nums">
        Página {page} de {pages}
      </span>
      <span className="flex gap-2">
        {page > 1 && (
          <Chip to={viewUrl(params, { pagina: String(page - 1) })} active={false}>
            Anterior
          </Chip>
        )}
        {page < pages && (
          <Chip to={viewUrl(params, { pagina: String(page + 1) })} active={false}>
            Siguiente
          </Chip>
        )}
      </span>
    </nav>
  );
}

function ActionRow({ action }: { action: ModerationAction }) {
  return (
    <li className="px-4 py-3">
      <p className="text-sm font-medium capitalize">{action.action.replaceAll("_", " ")}</p>
      <p className="text-xs text-muted-foreground">
        {action.targetType} <span className="font-mono">{action.targetId}</span>
        {action.reportId !== null && `, reporte #${action.reportId}`}
      </p>
      {action.reason && <p className="text-sm text-muted-foreground">{action.reason}</p>}
      <p className="text-xs text-muted-foreground">
        {action.actor ? `@${action.actor.username}` : "Sistema"}, {formatDateTime(action.createdAt)}
      </p>
    </li>
  );
}

export default function ModerationDashboard({ loaderData }: Route.ComponentProps) {
  const { view, reports, actions } = loaderData;
  const [params] = useSearchParams();
  const revalidator = useRevalidator();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = reports?.items.find((r) => r.id === selectedId) ?? null;
  const page = reports?.page ?? actions?.page ?? 1;
  const total = reports?.total ?? actions?.total ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 md:px-8">
      <AdminTabs current="/admin/moderation" />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-title-h4 md:text-title-h3">Moderación</h1>
          <p className="text-sm text-muted-foreground">
            {view === "cola"
              ? `${total} ${total === 1 ? "reporte pendiente" : "reportes pendientes"}`
              : `${total} en total`}
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          disabled={revalidator.state === "loading"}
          onClick={() => revalidator.revalidate()}
        >
          {revalidator.state === "loading" ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconRefresh className="size-4" />
          )}
          Actualizar
        </Button>
      </header>

      <section className="rounded-3xl bg-secondary/30 p-2">
        <div className="-mx-1 flex gap-2 overflow-x-auto p-3">
          {VIEWS.map((v) => (
            <Chip
              key={v.id}
              to={viewUrl(new URLSearchParams(), v.id === "cola" ? {} : { vista: v.id })}
              active={view === v.id}
            >
              {v.label}
            </Chip>
          ))}
        </div>

        {total === 0 ? (
          <p className="flex items-center justify-center gap-2 rounded-2xl bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            {view === "cola" && <IconCircleCheck className="size-5 text-success" />}
            {view === "cola" ? "Nada pendiente." : "Todavía no hay registros."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-card">
            <ul className="divide-y divide-border/50">
              {reports?.items.map((r) => (
                <ReportRow key={r.id} report={r} onOpen={() => setSelectedId(r.id)} />
              ))}
              {actions?.items.map((a) => (
                <ActionRow key={a.id} action={a} />
              ))}
            </ul>
            <Pager params={params} page={page} total={total} />
          </div>
        )}
      </section>

      <ReportDialog key={selected?.id} report={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function ReportDialog({ report, onClose }: { report: Report | null; onClose: () => void }) {
  const revalidator = useRevalidator();
  const [resolution, setResolution] = useState<ReportResolution | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"claim" | "resolve" | null>(null);
  const [history, setHistory] = useState<ModerationAction[]>([]);
  const targetType = report?.targetType;
  const targetId = report?.targetId;

  useEffect(() => {
    if (!targetType || !targetId) return;
    moderationClient
      .listActions({ targetType, targetId, pageSize: 10 })
      .then((res) => setHistory(res.items))
      .catch(() => {});
  }, [targetType, targetId]);

  async function run(kind: "claim" | "resolve", call: () => Promise<unknown>, done: string) {
    setBusy(kind);
    try {
      await call();
      toast.success(done);
      revalidator.revalidate();
      if (kind === "resolve") onClose();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      toast.error(
        code === "claimed_by_other"
          ? "Otra persona lo tiene tomado."
          : code === "already_resolved"
            ? "Ese reporte ya estaba resuelto."
            : error instanceof ApiError
              ? error.message
              : "No se pudo completar la acción.",
      );
      if (code) revalidator.revalidate();
    } finally {
      setBusy(null);
    }
  }

  const closed = report?.status === "resolved" || report?.status === "dismissed";
  const claimer = report ? claimedNow(report) : null;

  return (
    <Dialog open={report !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        {report && (
          <>
            <DialogHeader>
              <DialogTitle>
                {TARGET_LABELS[report.targetType]} <span className="font-mono text-base">{report.targetId}</span>
              </DialogTitle>
              <DialogDescription>
                {REASON_LABELS[report.reason]}, {STATUS_LABELS[report.status].toLowerCase()}. Reportó{" "}
                {report.reporter ? `@${report.reporter.username}` : "un usuario eliminado"} el{" "}
                {formatDateTime(report.createdAt)}. Sobre lo mismo hay {report.targetReportCount}{" "}
                {report.targetReportCount === 1 ? "reporte" : "reportes"}.
              </DialogDescription>
            </DialogHeader>

            {report.details && (
              <p className="whitespace-pre-wrap rounded-xl bg-secondary/50 p-3 text-sm">{report.details}</p>
            )}

            {history.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Bitácora de este objetivo</p>
                <ul className="max-h-32 divide-y divide-border/50 overflow-y-auto rounded-xl bg-secondary/30 text-xs">
                  {history.map((a) => (
                    <li key={a.id} className="px-3 py-2">
                      <span className="font-medium capitalize">{a.action.replaceAll("_", " ")}</span>{" "}
                      {a.actor ? `@${a.actor.username}` : "sistema"}, {formatDateTime(a.createdAt)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {closed ? (
              <p className="text-sm text-muted-foreground">
                {report.resolution ? RESOLUTION_LABELS[report.resolution] : STATUS_LABELS[report.status]}
                {report.resolvedBy && ` por @${report.resolvedBy.username}`}
                {report.resolutionNote && `: ${report.resolutionNote}`}
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {claimer
                      ? `Lo tiene @${claimer.username} hasta ${formatDateTime(report.claimedUntil ?? "")}`
                      : "Nadie lo ha tomado."}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() =>
                      run("claim", () => moderationClient.claim(report.id), "Reporte tomado por 15 minutos.")
                    }
                  >
                    {busy === "claim" && <IconLoader2 className="size-4 animate-spin" />}
                    Tomar
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Resolución</Label>
                  <div className="grid gap-1.5">
                    {REPORT_RESOLUTIONS.map((r) => (
                      <label
                        key={r}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors",
                          resolution === r ? "border-primary bg-primary/5" : "hover:bg-secondary",
                        )}
                      >
                        <input
                          type="radio"
                          name="resolution"
                          checked={resolution === r}
                          onChange={() => setResolution(r)}
                          className="accent-primary"
                        />
                        {RESOLUTION_LABELS[r]}
                      </label>
                    ))}
                  </div>
                </div>

                <Textarea
                  placeholder="Nota interna (opcional, queda en la bitácora)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={1000}
                  rows={2}
                />

                <DialogFooter>
                  <Button variant="secondary" disabled={busy !== null} onClick={onClose}>
                    Cerrar
                  </Button>
                  <Button
                    disabled={!resolution || busy !== null}
                    onClick={() =>
                      resolution &&
                      run(
                        "resolve",
                        () => moderationClient.resolve(report.id, { resolution, note: note.trim() || undefined }),
                        "Reporte resuelto.",
                      )
                    }
                  >
                    {busy === "resolve" && <IconLoader2 className="size-4 animate-spin" />}
                    Resolver
                  </Button>
                </DialogFooter>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
