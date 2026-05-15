import { IconCircleCheckFilled, IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/shared/components/primitives/button";
import { Input } from "~/shared/components/primitives/input";
import { Label } from "~/shared/components/primitives/label";
import { ApiError } from "~/shared/lib/api";
import { type ClaimCreateResponse, claimsService } from "../services/claims";
import { DnsInstructions } from "./dns-instructions";

interface ClaimWizardProps {
  token: string;
  onDone?: () => void;
}

type Step = "input" | "txt" | "verifying" | "verified" | "confirmed";

export function ClaimWizard({ token, onDone }: ClaimWizardProps) {
  const [step, setStep] = useState<Step>("input");
  const [domain, setDomain] = useState("");
  const [storeId, setStoreId] = useState("");
  const [claim, setClaim] = useState<ClaimCreateResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function createClaim() {
    if (!domain.trim()) return;
    setSubmitting(true);
    try {
      const res = await claimsService.create(domain.trim(), storeId.trim() || undefined, token);
      setClaim(res);
      setStep("txt");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Error creando claim");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyClaim() {
    if (!claim) return;
    setStep("verifying");
    try {
      const res = await claimsService.verify(claim.id, token);
      if (res.matched || res.status === "verified") {
        setStep("verified");
        toast.success("DNS verificado");
      } else {
        setStep("txt");
        toast.message("Todavía no se detecta el TXT. La propagación puede demorar.");
      }
    } catch (err) {
      setStep("txt");
      toast.error(err instanceof ApiError ? err.message : "Error verificando DNS");
    }
  }

  async function confirmClaim() {
    if (!claim) return;
    setSubmitting(true);
    try {
      await claimsService.confirm(claim.id, token);
      setStep("confirmed");
      toast.success("Listo, sos owner de esta tienda");
      onDone?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Error confirmando ownership");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "confirmed") {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
        <div className="flex items-center gap-2 font-medium text-primary">
          <IconCircleCheckFilled className="size-4" />
          Ownership otorgado
        </div>
        <p className="mt-2 text-muted-foreground">Ya podés editar la tienda desde su página de admin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="claim-domain">Dominio</Label>
        <Input
          id="claim-domain"
          placeholder="pcexpress.cl"
          value={domain}
          disabled={step !== "input"}
          onChange={(e) => setDomain(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="claim-store-id">store_id (opcional)</Label>
        <Input
          id="claim-store-id"
          placeholder="uuid de la tienda ya catalogada"
          value={storeId}
          disabled={step !== "input"}
          onChange={(e) => setStoreId(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          Si la tienda ya está en el catálogo, indicá su uuid para que el claim quede asociado.
        </p>
      </div>

      {step === "input" && (
        <Button onClick={createClaim} disabled={submitting || !domain.trim()}>
          {submitting && <IconLoader2 className="size-4 animate-spin" />}
          Generar TXT
        </Button>
      )}

      {claim && (step === "txt" || step === "verifying" || step === "verified") && (
        <>
          <DnsInstructions txtName={claim.txt_name} txtValue={claim.txt_value} />
          {step === "verified" ? (
            <Button onClick={confirmClaim} disabled={submitting}>
              {submitting && <IconLoader2 className="size-4 animate-spin" />}
              Confirmar y tomar ownership
            </Button>
          ) : (
            <Button onClick={verifyClaim} disabled={step === "verifying"}>
              {step === "verifying" && <IconLoader2 className="size-4 animate-spin" />}
              Verificar DNS
            </Button>
          )}
        </>
      )}
    </div>
  );
}
