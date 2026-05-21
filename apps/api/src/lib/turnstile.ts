import { Logger } from "@framerate/utils";

const logger = new Logger("Turnstile");

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
  hostname?: string;
  action?: string;
}

/**
 * Verifica un token de Cloudflare Turnstile.
 *
 * Si `secretKey` no está configurado (dev/local sin Turnstile), retorna `true`
 * para no romper el flujo. En producción siempre debe estar seteado.
 */
export async function verifyTurnstile(
  secretKey: string | undefined,
  token: string | undefined,
  remoteIp?: string | null,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!secretKey) {
    logger.warn("TURNSTILE_SECRET_KEY no configurado — saltando verificación (sólo aceptable en dev).");
    return { ok: true };
  }
  if (!token || typeof token !== "string") {
    return { ok: false, reason: "Missing turnstile token" };
  }

  const form = new URLSearchParams();
  form.append("secret", secretKey);
  form.append("response", token);
  if (remoteIp) form.append("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body: form,
    });
    const data = (await res.json()) as TurnstileResponse;
    if (data.success) return { ok: true };
    logger.warn(`Turnstile rejected: ${data["error-codes"]?.join(",") ?? "unknown"}`);
    return { ok: false, reason: "Captcha verification failed" };
  } catch (error) {
    logger.error(`Turnstile fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    return { ok: false, reason: "Captcha verification unavailable" };
  }
}
