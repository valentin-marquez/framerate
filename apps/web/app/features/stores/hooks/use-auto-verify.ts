import { useCallback, useEffect, useRef, useState } from "react";
import { claimsService, type DnsCheckResponse } from "../services/claims";

/**
 * Verificación pasiva del claim: en vez de que el usuario apriete un botón,
 * polleamos solos el peek de DNS (`dns-check`, read-only, sin cooldown del
 * RPC) con backoff exponencial. Apenas detectamos el TXT, hacemos el commit
 * real (`verify`) UNA vez y avisamos. El botón manual queda como atajo.
 */
const BACKOFF_MS = [5_000, 10_000, 20_000, 30_000, 60_000];
const FIRST_CHECK_DELAY_MS = 1_500;

export type AutoVerifyStatus = "idle" | "waiting" | "mismatch" | "error" | "verified";

export interface AutoVerifyState {
  status: AutoVerifyStatus;
  /** Registros TXT encontrados en el nombre esperado (para el diff del mismatch). */
  found: string[];
  /** Valor TXT que esperábamos. */
  expected: string;
  /** Timestamp del último chequeo (para el "último intento hace Ns"). */
  lastCheckedAt: number | null;
  /** Hay un chequeo en vuelo ahora mismo. */
  checking: boolean;
  /** Fuerza un chequeo inmediato y reinicia el backoff (botón "verificar ahora"). */
  checkNow: () => void;
}

export function useAutoVerify(opts: {
  claimId: string | null;
  token: string;
  /** Sólo pollea cuando está habilitado (p.ej. el wizard en el paso DNS). */
  enabled: boolean;
  onVerified: () => void;
}): AutoVerifyState {
  const { claimId, token, enabled, onVerified } = opts;

  const [status, setStatus] = useState<AutoVerifyStatus>("idle");
  const [found, setFound] = useState<string[]>([]);
  const [expected, setExpected] = useState("");
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);

  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  // El effect publica acá su "forzar chequeo ahora" para que `checkNow` lo
  // alcance sin re-montar el loop.
  const forceRef = useRef<() => void>(() => {});
  const checkNow = useCallback(() => forceRef.current(), []);

  useEffect(() => {
    if (!enabled || !claimId) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    let running = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const tick = async () => {
      clearTimer();
      if (cancelled || running) return;
      running = true;
      setChecking(true);

      let res: DnsCheckResponse | null = null;
      try {
        res = await claimsService.dnsCheck(claimId, token);
      } catch {
        res = null;
      }

      if (cancelled) {
        running = false;
        return;
      }
      setChecking(false);
      setLastCheckedAt(Date.now());

      if (res) {
        setExpected(res.expected);
        setFound(res.found);
        if (res.matched) {
          // Commit real: una sola llamada al RPC, al detectar el match.
          try {
            const commit = await claimsService.verify(claimId, token);
            if (cancelled) {
              running = false;
              return;
            }
            if (commit.matched || commit.status === "verified") {
              setStatus("verified");
              running = false;
              onVerifiedRef.current();
              return; // detenemos el loop
            }
          } catch {
            // commit falló (cooldown del RPC, red) — seguimos polleando.
          }
        }
        if (!cancelled) {
          setStatus(res.status === "mismatch" ? "mismatch" : res.status === "error" ? "error" : "waiting");
        }
      } else {
        setStatus("error");
      }

      running = false;
      if (cancelled) return;
      const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
      attempt += 1;
      timer = setTimeout(tick, delay);
    };

    forceRef.current = () => {
      if (running) return;
      attempt = 0;
      void tick();
    };

    setStatus("waiting");
    timer = setTimeout(tick, FIRST_CHECK_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimer();
      forceRef.current = () => {};
    };
  }, [enabled, claimId, token]);

  return { status, found, expected, lastCheckedAt, checking, checkNow };
}
