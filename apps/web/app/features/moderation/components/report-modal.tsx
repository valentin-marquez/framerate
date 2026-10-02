import type { ReportReason, ReportTargetType } from "@framerate/contracts";
import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { REASON_LABELS, REASONS_BY_TARGET, reportsClient } from "../services/reports";

export interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ReportTargetType;
  targetId: string;
  /** Texto descriptivo opcional para mostrar contexto en el header. */
  contextLabel?: string;
}

export function ReportModal({ open, onOpenChange, targetType, targetId, contextLabel }: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason) {
      toast.error("Elige un motivo.");
      return;
    }
    setSubmitting(true);
    try {
      await reportsClient.create({ targetType, targetId, reason, details: details.trim() || undefined });
      toast.success("Reporte enviado. Gracias por ayudarnos a moderar.");
      setReason("");
      setDetails("");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          toast.error("Ya tienes un reporte abierto sobre este contenido.");
        } else if (error.status === 404) {
          toast.error("Ese contenido ya no existe.");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error("No pudimos enviar el reporte. Inténtalo de nuevo.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconAlertTriangle className="size-5 text-amber-500" aria-hidden="true" />
            Reportar contenido
          </DialogTitle>
          <DialogDescription>
            {contextLabel ? `Reportar: ${contextLabel}` : "Cuéntanos por qué este contenido viola las reglas."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-reason">Motivo</Label>
            <div className="grid grid-cols-1 gap-1.5">
              {REASONS_BY_TARGET[targetType].map((r) => (
                <label
                  key={r}
                  className={cn(
                    "flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm cursor-pointer transition-colors",
                    reason === r ? "border-primary bg-primary/5" : "hover:bg-secondary",
                  )}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="mt-0.5 accent-primary"
                  />
                  <span>{REASON_LABELS[r]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="report-details">Detalles (opcional)</Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Cualquier detalle que ayude a quien modera."
            />
            <span className="text-xs text-muted-foreground self-end">{details.length}/1000</span>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" disabled={submitting} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !reason}>
              {submitting ? <IconLoader2 className="size-4 animate-spin" /> : null}
              {submitting ? "Enviando..." : "Enviar reporte"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
