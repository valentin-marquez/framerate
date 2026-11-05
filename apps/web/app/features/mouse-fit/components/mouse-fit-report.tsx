import { type Hand, MOUSE_FITS } from "@framerate/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { productsService } from "~/features/product/services/products";
import { TurnstileWidget } from "~/features/support/components/turnstile-widget";
import { Button } from "~/shared/components/primitives/button";
import { Input } from "~/shared/components/primitives/input";
import { markReported } from "../hand-storage";
import { mouseFitClient } from "../services/mouse-fit";

const FIT_LABELS: Record<(typeof MOUSE_FITS)[number], string> = { small: "Chico", right: "Justo", large: "Grande" };

/** Pregunta de calibración (#218): opcional, y sólo se envía al apretar el botón. */
export function MouseFitReport({ hand, onDone }: { hand: Hand; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [mouse, setMouse] = useState<{ slug: string; name: string } | null>(null);
  const [fit, setFit] = useState<(typeof MOUSE_FITS)[number] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");

  const results = useQuery({
    queryKey: ["mouse-fit-search", query],
    queryFn: () => productsService.getAll({ category: "mouses", search: query, limit: 5 }),
    enabled: !mouse && query.trim().length >= 2,
  });

  const send = async () => {
    if (!mouse || !fit || !token) return;
    setState("sending");
    try {
      await mouseFitClient.report({ ...hand, product_slug: mouse.slug, fit, turnstileToken: token });
      markReported();
      onDone();
    } catch {
      setState("error");
    }
  };

  return (
    <div className="flex flex-col gap-3 border-border/60 border-t pt-4">
      <p className="text-center font-medium text-sm sm:text-left">
        Ayúdanos a afinarlo: ¿qué mouse usas hoy y qué tal te queda?
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="Busca tu mouse"
          placeholder="Busca tu mouse"
          value={mouse?.name ?? query}
          onChange={(e) => {
            setMouse(null);
            setQuery(e.target.value);
          }}
        />
        <div className="grid shrink-0 grid-cols-3 gap-2">
          {MOUSE_FITS.map((value) => (
            <Button
              key={value}
              type="button"
              className="px-3"
              variant={fit === value ? "default" : "outline"}
              aria-pressed={fit === value}
              onClick={() => setFit(value)}
            >
              {FIT_LABELS[value]}
            </Button>
          ))}
        </div>
      </div>
      {!mouse && (results.data?.items.length ?? 0) > 0 && (
        <ul className="flex flex-col gap-1">
          {results.data?.items.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted/50"
                onClick={() => setMouse({ slug: p.slug, name: p.name })}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {mouse && fit && (
        <>
          <TurnstileWidget onVerify={setToken} onExpire={() => setToken(null)} onError={() => setToken(null)} />
          <Button type="button" variant="secondary" disabled={!token || state === "sending"} onClick={send}>
            Enviar mi respuesta
          </Button>
        </>
      )}
      <p className="text-center text-muted-foreground text-xs sm:text-left">
        {state === "error"
          ? "No pudimos enviarla; intenta de nuevo."
          : "Es opcional. Enviamos tus medidas, tu agarre y tu mouse, sin tu nombre ni tu cuenta."}
      </p>
    </div>
  );
}
