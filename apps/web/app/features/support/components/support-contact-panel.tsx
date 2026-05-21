import {
  IconAlertTriangle,
  IconBug,
  IconBuildingStore,
  IconCheck,
  IconCircleCheck,
  IconDatabase,
  IconHelp,
  IconLoader2,
  IconMessageCircle,
  IconShieldLock,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { domAnimation, LazyMotion, MotionConfig, m, type Transition } from "motion/react";
import { type FormEvent, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { useAuthStore } from "~/features/auth/store/auth";
import { Button } from "~/shared/components/primitives/button";
import { Input } from "~/shared/components/primitives/input";
import { Label } from "~/shared/components/primitives/label";
import { Textarea } from "~/shared/components/primitives/textarea";
import { ApiError } from "~/shared/lib/api";
import { cn } from "~/shared/lib/utils";
import { type CreateTicketPayload, type SupportCategory, supportClient } from "../services/support";
import { TurnstileWidget } from "./turnstile-widget";

const TURNSTILE_CONFIGURED = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

// Wipe de doble onda. Dos círculos sólidos crecen desde el centro:
//   1. `bg-primary` (color del botón) — primer pulso.
//   2. `bg-card` (color base del container) — segundo pulso, tapa al primero.
// Animamos `scale` (transform → compositor) en vez de clip-path para que
// corra a 60fps sin lag. El swap de contenido ocurre con todo cubierto.
const EASE_OUT: Transition["ease"] = [0.33, 1, 0.68, 1];
const COVER_DUR = 0.2;
const COVER_LAYER_GAP = 0.14; // retardo de la 2ª onda respecto de la 1ª
const REVEAL_DUR = 0.22;
const REVEAL_LAYER_GAP = 0.1;

interface CategoryOption {
  id: SupportCategory;
  label: string;
  hint: string;
  Icon: typeof IconHelp;
}

const CATEGORIES: CategoryOption[] = [
  { id: "privacy", label: "Privacidad", hint: "Datos personales, ARCO", Icon: IconShieldLock },
  { id: "data_request", label: "Mis datos", hint: "Exportar o eliminar", Icon: IconDatabase },
  { id: "abuse_report", label: "Abuso", hint: "Contenido inapropiado", Icon: IconAlertTriangle },
  { id: "store_issue", label: "Tienda", hint: "Reclamo, perfil, dueños", Icon: IconBuildingStore },
  { id: "bug", label: "Bug", hint: "Algo no funciona", Icon: IconBug },
  { id: "feature", label: "Sugerencia", hint: "Idea o mejora", Icon: IconSparkles },
  { id: "other", label: "Otro", hint: "Cualquier otra cosa", Icon: IconHelp },
];

type ViewKind = "idle" | "form" | "done";
type WipePhase = null | "cover" | "reveal";

interface SupportContactPanelProps {
  defaultCategory?: SupportCategory;
  triggerLabel?: string;
}

// Círculo sólido del wipe. `w-[300%] aspect-square` + centrado con `m-auto`
// asegura cubrir las esquinas del rectángulo a `scale: 1`. Sólo animamos
// `scale` para mantener el trabajo en el compositor (60fps).
const WIPE_CIRCLE_CLASS = "absolute inset-0 m-auto aspect-square w-[300%] rounded-full pointer-events-none";

export function SupportContactPanel({
  defaultCategory = "privacy",
  triggerLabel = "Contactar a soporte",
}: SupportContactPanelProps) {
  const formId = useId();
  const { user, supabase } = useAuthStore();
  const isAuthed = Boolean(user);

  const [view, setView] = useState<ViewKind>("idle");
  const [wipe, setWipe] = useState<WipePhase>(null);
  const pendingViewRef = useRef<ViewKind>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [doneTicketId, setDoneTicketId] = useState<string | null>(null);
  const [category, setCategory] = useState<SupportCategory>(defaultCategory);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const subjectInputRef = useRef<HTMLInputElement | null>(null);

  function resetFields() {
    setSubject("");
    setBody("");
    setEmail("");
    setTurnstileToken(null);
    setCategory(defaultCategory);
  }

  /** Dispara el wipe de doble onda hacia un nuevo estado. */
  function transitionTo(next: ViewKind) {
    if (wipe) return; // transición en curso
    pendingViewRef.current = next;
    setWipe("cover");
  }

  /**
   * La onda que termina última en cada fase dispara el avance:
   *  - fin de "cover" (onda 2 / card): todo está cubierto → swap de contenido
   *    y arranca "reveal".
   *  - fin de "reveal" (onda 1 / primary): el wipe terminó → limpiamos.
   */
  function onCoverLayerDone() {
    if (wipe !== "cover") return;
    const next = pendingViewRef.current;
    if (next === "idle") resetFields();
    setView(next);
    setWipe("reveal");
    if (next === "form") {
      window.setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        const target = isAuthed ? subjectInputRef.current : emailInputRef.current;
        target?.focus({ preventScroll: true });
      }, 60);
    }
  }

  function onRevealLayerDone() {
    if (wipe !== "reveal") return;
    setWipe(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || wipe) return;

    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();

    if (trimmedSubject.length < 3) {
      toast.error("El asunto necesita al menos 3 caracteres.");
      return;
    }
    if (trimmedBody.length < 10) {
      toast.error("El mensaje necesita al menos 10 caracteres.");
      return;
    }
    if (!isAuthed) {
      if (!email.trim()) {
        toast.error("Necesitamos un email para responderte.");
        return;
      }
      if (TURNSTILE_CONFIGURED && !turnstileToken) {
        toast.error("Esperá a que termine la verificación anti-spam.");
        return;
      }
    }

    setSubmitting(true);
    try {
      let token: string | undefined;
      if (isAuthed && supabase) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token;
      }

      const payload: CreateTicketPayload = {
        category,
        subject: trimmedSubject,
        body: trimmedBody,
      };
      if (!isAuthed) {
        payload.email = email.trim();
        payload.turnstile_token = turnstileToken ?? undefined;
      }

      const result = await supportClient.create(payload, token);
      setDoneTicketId(result.id);
      transitionTo("done");
    } catch (error) {
      setTurnstileResetKey((k) => k + 1);
      setTurnstileToken(null);
      const message = error instanceof ApiError ? error.message : "No pudimos enviar tu mensaje. Probá de nuevo.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const isFormView = view === "form";
  const covered = wipe === "cover";

  // Onda 1 (primary): entra primero al cubrir, sale última al revelar.
  const layer1Scale = covered ? 1 : 0;
  const layer1Transition: Transition = {
    duration: covered ? COVER_DUR : REVEAL_DUR,
    ease: EASE_OUT,
    delay: covered ? 0 : REVEAL_LAYER_GAP,
  };
  // Onda 2 (card): entra última al cubrir, sale primera al revelar.
  const layer2Scale = covered ? 1 : 0;
  const layer2Transition: Transition = {
    duration: covered ? COVER_DUR : REVEAL_DUR,
    ease: EASE_OUT,
    delay: covered ? COVER_LAYER_GAP : 0,
  };

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-2xl border border-border/40 bg-card scroll-mt-24"
        >
          {/*
            Base: el form fija el tamaño de la caja en idle y form (`invisible`
            en idle → la caja conserva el tamaño del form; idle es un overlay).
            En `done` se oculta con `hidden` para que la caja se ajuste al
            contenido compacto del éxito.
          */}
          <div className={cn(view === "idle" && "invisible", view === "done" && "hidden")} inert={!isFormView}>
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="space-y-1">
                  <h3 className="font-semibold tracking-tight text-lg">Contactar a soporte</h3>
                  <p className="text-sm text-muted-foreground">
                    {isAuthed
                      ? "Te respondemos dentro de la plataforma. Vas a recibir las respuestas en tu cuenta."
                      : "Te respondemos al email que nos dejes. Si tenés cuenta, iniciá sesión para ver la conversación dentro del sitio."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => transitionTo("idle")}
                  aria-label="Cerrar"
                  disabled={submitting}
                >
                  <IconX className="size-4" />
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <fieldset className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    ¿Sobre qué?
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CATEGORIES.map(({ id, label, hint, Icon }) => {
                      const active = category === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setCategory(id)}
                          disabled={submitting}
                          aria-pressed={active}
                          className={cn(
                            "flex items-start gap-2 rounded-xl border p-2.5 text-left transition-all cursor-pointer",
                            active
                              ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                              : "border-border/60 bg-background/40 hover:bg-background/70 hover:border-border",
                          )}
                        >
                          <Icon
                            className={cn("size-4 mt-0.5 shrink-0", active ? "text-primary" : "text-muted-foreground")}
                          />
                          <span className="min-w-0">
                            <span
                              className={cn("block text-sm font-medium leading-tight", active && "text-foreground")}
                            >
                              {label}
                            </span>
                            <span className="block text-[11px] text-muted-foreground leading-snug">{hint}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {!isAuthed && (
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`${formId}-email`}
                      className="text-xs uppercase tracking-wider text-muted-foreground font-medium"
                    >
                      Email
                    </Label>
                    <Input
                      ref={emailInputRef}
                      id={`${formId}-email`}
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={submitting}
                      placeholder="tucorreo@ejemplo.cl"
                      autoComplete="email"
                      maxLength={320}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label
                    htmlFor={`${formId}-subject`}
                    className="text-xs uppercase tracking-wider text-muted-foreground font-medium"
                  >
                    Asunto
                  </Label>
                  <Input
                    ref={subjectInputRef}
                    id={`${formId}-subject`}
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={submitting}
                    placeholder="Resumen breve"
                    minLength={3}
                    maxLength={200}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor={`${formId}-body`}
                    className="text-xs uppercase tracking-wider text-muted-foreground font-medium"
                  >
                    Mensaje
                  </Label>
                  <Textarea
                    id={`${formId}-body`}
                    required
                    rows={5}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    disabled={submitting}
                    placeholder="Contanos qué pasa con el detalle que tengas (links, capturas mentales, lo que sea útil)."
                    minLength={10}
                    maxLength={5000}
                  />
                  <p className="text-[11px] text-muted-foreground text-right">{body.length}/5000</p>
                </div>

                {!isAuthed && TURNSTILE_CONFIGURED && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Verificación anti-spam
                    </Label>
                    <TurnstileWidget
                      onVerify={(token) => setTurnstileToken(token)}
                      onExpire={() => setTurnstileToken(null)}
                      onError={() => setTurnstileToken(null)}
                      resetSignal={turnstileResetKey}
                    />
                  </div>
                )}
                {!isAuthed && !TURNSTILE_CONFIGURED && (
                  <p className="text-xs text-muted-foreground italic">
                    Captcha desactivado en este entorno (sin <code>VITE_TURNSTILE_SITE_KEY</code>).
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => transitionTo("idle")}
                    disabled={submitting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting || (!isAuthed && TURNSTILE_CONFIGURED && !turnstileToken)}
                  >
                    {submitting ? <IconLoader2 className="size-4 animate-spin" /> : <IconCheck className="size-4" />}
                    {submitting ? "Enviando…" : "Enviar"}
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* IDLE: overlay con el botón centrado. */}
          {view === "idle" && (
            <div className="absolute inset-0 grid place-items-center bg-card p-6 text-center" inert={wipe !== null}>
              <div>
                <p className="text-sm text-muted-foreground mb-4">¿Tenés dudas sobre cómo manejamos tu información?</p>
                <Button
                  type="button"
                  onClick={() => transitionTo("form")}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <IconMessageCircle className="size-4" />
                  {triggerLabel}
                </Button>
              </div>
            </div>
          )}

          {/* DONE: en flujo normal — la caja se ajusta a este contenido. */}
          {view === "done" && (
            <div className="bg-success/5 p-6">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-full bg-success/10 flex items-center justify-center shrink-0 shadow-[0_0_15px_-3px_var(--color-success)] shadow-success/20">
                  <IconCircleCheck className="text-success" size={26} stroke={2} />
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  <h3 className="font-semibold text-lg tracking-tight">Mensaje enviado</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Recibimos tu ticket{" "}
                    <code className="text-xs bg-background/60 px-1.5 py-0.5 rounded border border-border/60">
                      {doneTicketId?.slice(0, 8) ?? ""}
                    </code>
                    . Un miembro del equipo te responde dentro de la plataforma.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {isAuthed && (
                      <Link
                        to="/settings/tickets"
                        className="inline-flex h-8 items-center justify-center gap-1 rounded-xl bg-secondary/70 px-3 text-sm font-medium text-secondary-foreground/80 transition-colors hover:bg-primary hover:text-primary-foreground"
                      >
                        Ver mis tickets
                      </Link>
                    )}
                    <Button type="button" variant="secondary" size="sm" onClick={() => transitionTo("idle")}>
                      Cerrar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WIPE — doble onda. Onda 1 = primary; onda 2 = card, encima. */}
          <m.div
            aria-hidden
            initial={false}
            animate={{ scale: layer1Scale }}
            transition={layer1Transition}
            onAnimationComplete={onRevealLayerDone}
            style={{ willChange: "transform" }}
            className={cn(WIPE_CIRCLE_CLASS, "z-20 bg-primary")}
          />
          <m.div
            aria-hidden
            initial={false}
            animate={{ scale: layer2Scale }}
            transition={layer2Transition}
            onAnimationComplete={onCoverLayerDone}
            style={{ willChange: "transform" }}
            className={cn(WIPE_CIRCLE_CLASS, "z-30 bg-card")}
          />
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
