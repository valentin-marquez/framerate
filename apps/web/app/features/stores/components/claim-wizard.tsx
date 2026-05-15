import { IconCircleCheckFilled, IconLoader2 } from "@tabler/icons-react";
import { useReducer } from "react";
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

// El wizard es una máquina de estados explícita; useReducer modela bien las
// transiciones step + datos asociados (domain, storeId, claim, submitting).
type WizardState = {
  step: Step;
  domain: string;
  storeId: string;
  claim: ClaimCreateResponse | null;
  submitting: boolean;
};

type WizardAction =
  | { type: "set-domain"; domain: string }
  | { type: "set-store-id"; storeId: string }
  | { type: "submitting"; submitting: boolean }
  | { type: "go-txt"; claim: ClaimCreateResponse }
  | { type: "go-verifying" }
  | { type: "go-verified" }
  | { type: "back-to-txt" }
  | { type: "confirmed" };

const initialWizardState: WizardState = {
  step: "input",
  domain: "",
  storeId: "",
  claim: null,
  submitting: false,
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "set-domain":
      return { ...state, domain: action.domain };
    case "set-store-id":
      return { ...state, storeId: action.storeId };
    case "submitting":
      return { ...state, submitting: action.submitting };
    case "go-txt":
      return { ...state, claim: action.claim, step: "txt" };
    case "go-verifying":
      return { ...state, step: "verifying" };
    case "go-verified":
      return { ...state, step: "verified" };
    case "back-to-txt":
      return { ...state, step: "txt" };
    case "confirmed":
      return { ...state, step: "confirmed", submitting: false };
    default:
      return state;
  }
}

export function ClaimWizard({ token, onDone }: ClaimWizardProps) {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const { step, domain, storeId, claim, submitting } = state;

  async function createClaim() {
    if (!domain.trim()) return;
    dispatch({ type: "submitting", submitting: true });
    try {
      const res = await claimsService.create(domain.trim(), storeId.trim() || undefined, token);
      dispatch({ type: "go-txt", claim: res });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Error creando claim");
    } finally {
      dispatch({ type: "submitting", submitting: false });
    }
  }

  async function verifyClaim() {
    if (!claim) return;
    dispatch({ type: "go-verifying" });
    try {
      const res = await claimsService.verify(claim.id, token);
      if (res.matched || res.status === "verified") {
        dispatch({ type: "go-verified" });
        toast.success("DNS verificado");
      } else {
        dispatch({ type: "back-to-txt" });
        toast.message("Todavía no se detecta el TXT. La propagación puede demorar.");
      }
    } catch (err) {
      dispatch({ type: "back-to-txt" });
      toast.error(err instanceof ApiError ? err.message : "Error verificando DNS");
    }
  }

  async function confirmClaim() {
    if (!claim) return;
    dispatch({ type: "submitting", submitting: true });
    try {
      await claimsService.confirm(claim.id, token);
      dispatch({ type: "confirmed" });
      toast.success("Listo, sos owner de esta tienda");
      onDone?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Error confirmando ownership");
      dispatch({ type: "submitting", submitting: false });
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
          onChange={(e) => dispatch({ type: "set-domain", domain: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="claim-store-id">store_id (opcional)</Label>
        <Input
          id="claim-store-id"
          placeholder="uuid de la tienda ya catalogada"
          value={storeId}
          disabled={step !== "input"}
          onChange={(e) => dispatch({ type: "set-store-id", storeId: e.target.value })}
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
