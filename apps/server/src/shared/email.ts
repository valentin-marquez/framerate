import { type Email, render } from "@framerate/emails";
import { createLogger } from "@framerate/kit";
import type { Context } from "hono";
import type { AppEnv } from "@/app";
import type { Env } from "@/env";

const SUPPORT_ADDRESS = "soporte@framerate.cl";
const log = createLogger({ feature: "email" });

/**
 * Envía un correo de `@framerate/emails`. Nunca lanza: un correo que falla queda en el log y no tumba la petición
 * que lo originó. Sin binding (tests) no envía nada.
 */
export async function sendEmail(env: Env, to: string, { subject, element }: Email) {
  if (!env.EMAIL) {
    log.info("email_skipped", { subject });
    return;
  }
  try {
    const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
    const { messageId } = await env.EMAIL.send({
      from: { email: SUPPORT_ADDRESS, name: "Framerate" },
      to,
      replyTo: SUPPORT_ADDRESS,
      subject,
      html,
      text,
    });
    log.info("email_sent", { messageId, subject });
  } catch (error) {
    log.error("email_failed", { error, subject, code: (error as { code?: string }).code });
  }
}

/** Envía después de responder (`waitUntil`), para que el correo no demore la respuesta. */
export function sendEmailInBackground(c: Context<AppEnv>, to: string, email: Email) {
  const sending = sendEmail(c.env, to, email);
  try {
    c.executionCtx.waitUntil(sending);
  } catch {
    // Sin ExecutionContext (tests con `app.request` sin contexto) la promesa sigue sola.
  }
}
