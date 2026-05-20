import { IconArrowLeft, IconCircleCheckFilled, IconLoader2 } from "@tabler/icons-react";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "~/shared/components/primitives/button";
import { StoreLogo } from "~/shared/components/store-logo";
import { ApiError } from "~/shared/lib/api";
import { type ClaimRequest, claimsService } from "../services/claims";
import type { ClaimableStore } from "../services/stores";
import { DnsInstructions } from "./dns-instructions";
import { StorePicker } from "./store-picker";

interface ClaimWizardProps {
  token: string;
  /** Si viene, el wizard arranca retomando este claim (sin pasar por el selector). */
  initialClaim?: ClaimRequest;
  /**
   * Si viene (deep-link `/reclamar?store=<slug>`), el wizard arranca creando
   * automáticamente el claim para esta tienda y salta al paso de DNS.
   */
  initialStore?: ClaimableStore;
  onDone?: () => void;
  onCancel?: () => void;
}

type Step = "pick" | "dns" | "verifying" | "verified" | "confirmed";

/** Identidad visible de la tienda que se está reclamando (contexto en cada paso). */
type Identity = { name: string | null; slug: string | null; iconUrl: string | null; domain: string };
type ActiveClaim = { id: string; txtName: string; txtValue: string };

type WizardState = {
  step: Step;
  identity: Identity | null;
  claim: ActiveClaim | null;
  submitting: boolean;
};

type WizardAction =
  | { type: "submitting"; submitting: boolean }
  | { type: "go-dns"; identity: Identity; claim: ActiveClaim }
  | { type: "go-verifying" }
  | { type: "go-verified" }
  | { type: "back-to-dns" }
  | { type: "confirmed" };

function initState(initialClaim?: ClaimRequest): WizardState {
  if (initialClaim) {
    return {
      step: initialClaim.status === "verified" ? "verified" : "dns",
      identity: { name: null, slug: null, iconUrl: null, domain: initialClaim.claimed_domain },
      claim: {
        id: initialClaim.id,
        txtName: initialClaim.txt_record_name,
        txtValue: initialClaim.txt_record_value,
      },
      submitting: false,
    };
  }
  return { step: "pick", identity: null, claim: null, submitting: false };
}

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "submitting":
      return { ...state, submitting: action.submitting };
    case "go-dns":
      return { ...state, step: "dns", identity: action.identity, claim: action.claim, submitting: false };
    case "go-verifying":
      return { ...state, step: "verifying" };
    case "go-verified":
      return { ...state, step: "verified" };
    case "back-to-dns":
      return { ...state, step: "dns" };
    case "confirmed":
      return { ...state, step: "confirmed", submitting: false };
    default:
      return state;
  }
}

const STEPS = ["Elegí tu tienda", "Verificá el dominio", "Confirmá"] as const;

function stepIndex(step: Step): number {
  if (step === "pick") return 0;
  if (step === "confirmed") return 2;
  return 1;
}

export function ClaimWizard({ token, initialClaim, initialStore, onDone, onCancel }: ClaimWizardProps) {
  const [state, dispatch] = useReducer(wizardReducer, initialClaim, initState);
  const { step, identity, claim, submitting } = state;
  const current = stepIndex(step);

  const selectStore = useCallback(
    async (store: ClaimableStore) => {
      dispatch({ type: "submitting", submitting: true });
      try {
        const res = await claimsService.create(store.id, token);
        dispatch({
          type: "go-dns",
          identity: { name: store.name, slug: store.slug, iconUrl: store.icon_url, domain: res.domain },
          claim: { id: res.id, txtName: res.txt_name, txtValue: res.txt_value },
        });
      } catch (err) {
        // 409 -> ya existe un claim activo para este dominio (probablemente
        // creado por este mismo usuario en otra sesión). Buscamos en listMine
        // el claim pending/verified y resumimos el wizard ahí. Si no lo
        // encontramos, mostramos el mensaje del API y caemos al picker.
        if (err instanceof ApiError && err.status === 409) {
          try {
            const { claims: mine } = await claimsService.listMine(token);
            const existing = mine.find(
              (c) => c.store_id === store.id && (c.status === "pending" || c.status === "verified"),
            );
            if (existing) {
              dispatch({
                type: "go-dns",
                identity: {
                  name: store.name,
                  slug: store.slug,
                  iconUrl: store.icon_url,
                  domain: existing.claimed_domain,
                },
                claim: {
                  id: existing.id,
                  txtName: existing.txt_record_name,
                  txtValue: existing.txt_record_value,
                },
              });
              if (existing.status === "verified") {
                dispatch({ type: "go-verified" });
              }
              toast.message("Retomamos tu reclamo en curso para esta tienda.");
              return;
            }
          } catch {
            // si listMine también falla, seguimos al toast genérico abajo
          }
        }
        const msg = err instanceof ApiError ? err.message : "No se pudo iniciar el reclamo";
        toast.error(msg);
        dispatch({ type: "submitting", submitting: false });
      }
    },
    [token],
  );

  // Auto-seleccionar la tienda cuando llega vía deep-link (`/reclamar?store=`)
  // y no hay un claim previo que retomar. `autoSelectedRef` garantiza que
  // dispara una sola vez por instancia del wizard — la page remonta el
  // componente con `key` cuando cambia el contexto.
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (initialClaim || !initialStore) return;
    autoSelectedRef.current = true;
    void selectStore(initialStore);
  }, [initialClaim, initialStore, selectStore]);

  async function verifyClaim() {
    if (!claim) return;
    dispatch({ type: "go-verifying" });
    try {
      const res = await claimsService.verify(claim.id, token);
      if (res.matched || res.status === "verified") {
        dispatch({ type: "go-verified" });
        toast.success("Dominio verificado");
      } else {
        dispatch({ type: "back-to-dns" });
        toast.message("Todavía no detectamos el registro TXT. La propagación DNS puede demorar.");
      }
    } catch (err) {
      dispatch({ type: "back-to-dns" });
      toast.error(err instanceof ApiError ? err.message : "Error verificando el DNS");
    }
  }

  async function confirmClaim() {
    if (!claim) return;
    dispatch({ type: "submitting", submitting: true });
    try {
      await claimsService.confirm(claim.id, token);
      dispatch({ type: "confirmed" });
      toast.success("Listo, ya sos dueño de esta tienda");
      onDone?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo confirmar la propiedad");
      dispatch({ type: "submitting", submitting: false });
    }
  }

  return (
    <div className="space-y-5">
      <Stepper current={current} />

      {step === "pick" &&
        (initialStore && submitting ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border/40 bg-secondary/30 p-8 text-muted-foreground text-sm">
            <IconLoader2 className="size-4 animate-spin" />
            Preparando reclamo para {initialStore.name}…
          </div>
        ) : (
          <StorePicker onSelect={selectStore} busy={submitting} />
        ))}

      {identity && step !== "pick" && step !== "confirmed" && (
        <>
          <IdentityCard identity={identity} />
          <DnsInstructions txtName={claim?.txtName ?? ""} txtValue={claim?.txtValue ?? ""} />

          {step === "verified" ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 font-medium text-primary text-sm">
                <IconCircleCheckFilled className="size-4" />
                Dominio verificado
              </div>
              <p className="mt-1 text-muted-foreground text-sm">
                Confirmá para tomar la propiedad y poder gestionar la tienda.
              </p>
              <Button className="mt-3" onClick={confirmClaim} disabled={submitting}>
                {submitting && <IconLoader2 className="size-4 animate-spin" />}
                Confirmar y tomar propiedad
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={verifyClaim} disabled={step === "verifying"}>
                {step === "verifying" && <IconLoader2 className="size-4 animate-spin" />}
                {step === "verifying" ? "Verificando…" : "Ya agregué el TXT, verificar"}
              </Button>
              {onCancel && (
                <Button variant="ghost" onClick={onCancel} disabled={step === "verifying"}>
                  <IconArrowLeft className="size-4" />
                  Volver
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {step === "confirmed" && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-center">
          <IconCircleCheckFilled className="mx-auto size-8 text-primary" />
          <p className="mt-2 font-medium">¡Propiedad confirmada!</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Ya podés editar la tienda desde su panel de administración.
          </p>
          {identity?.slug && (
            <Button className="mt-4" nativeButton={false} render={<Link to={`/tiendas/${identity.slug}/admin`} />}>
              Ir al panel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={[
                "flex size-6 shrink-0 items-center justify-center rounded-full font-semibold text-xs transition-colors",
                done || active ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground",
              ].join(" ")}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={["truncate text-xs", active ? "font-medium text-foreground" : "text-muted-foreground"].join(
                " ",
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border/60" />}
          </li>
        );
      })}
    </ol>
  );
}

function IdentityCard({ identity }: { identity: Identity }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-secondary/30 p-3">
      <StoreLogo
        store={{ name: identity.name ?? identity.domain, slug: identity.slug, icon_url: identity.iconUrl }}
        className="size-10"
      />
      <div className="min-w-0">
        <div className="truncate font-medium text-sm">{identity.name ?? identity.domain}</div>
        <div className="truncate text-muted-foreground text-xs">{identity.domain}</div>
      </div>
    </div>
  );
}
