import { useEffect, useId, useRef } from "react";

// Site key de TESTING de Cloudflare (siempre pasa). Útil cuando el deploy
// todavía no configuró un sitio real. En prod, setear VITE_TURNSTILE_SITE_KEY.
const TESTING_SITE_KEY = "1x00000000000000000000AA";

const SITE_KEY: string = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? TESTING_SITE_KEY;

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "flexible" | "compact";
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src^="${SCRIPT_SRC.split("?")[0]}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("turnstile script failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile script failed"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  /** Permite resetear el widget desde afuera tras un error de submit. */
  resetSignal?: number;
}

export function TurnstileWidget({ onVerify, onError, onExpire, resetSignal }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const elementId = useId();

  // biome-ignore lint/correctness/useExhaustiveDependencies: callbacks intencionalmente excluidas para no re-renderizar el widget
  useEffect(() => {
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        // Si el componente se remontó con un widget vivo, lo limpiamos primero.
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            /* swallow */
          }
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: onVerify,
          "error-callback": onError,
          "expired-callback": onExpire,
          theme: "auto",
        });
      })
      .catch(() => {
        onError?.();
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* swallow */
        }
        widgetIdRef.current = null;
      }
    };
  }, []);

  // Reset programático cuando el padre lo pide (p.ej. tras un submit fallido).
  useEffect(() => {
    if (resetSignal === undefined) return;
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        /* swallow */
      }
    }
  }, [resetSignal]);

  return <div ref={containerRef} id={elementId} className="flex justify-center" />;
}
