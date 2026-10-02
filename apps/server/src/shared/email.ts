import { type Email, render } from "@framerate/emails";
import { createLogger } from "@framerate/kit";
import type { Context } from "hono";
import type { AppEnv } from "@/app";
import type { Env } from "@/env";

export const SUPPORT_ADDRESS = "soporte@framerate.cl";
const log = createLogger({ feature: "email" });

/**
 * Envía un correo de `@framerate/emails` y devuelve su Message-ID. Nunca lanza: un correo que falla queda en el log
 * y no tumba lo que lo originó. Sin binding (tests) no envía nada.
 */
export async function sendEmail(env: Env, to: string, { subject, element }: Email): Promise<string | null> {
  if (!env.EMAIL) {
    log.info("email_skipped", { subject });
    return null;
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
    return messageId;
  } catch (error) {
    log.error("email_failed", { error, subject, code: (error as { code?: string }).code });
    return null;
  }
}

/**
 * Envía después de responder (`waitUntil`), para que el correo no demore la respuesta. `onSent` recibe el
 * Message-ID si salió (p. ej. para guardarlo y reconocer la respuesta de la persona).
 */
export function sendEmailInBackground(
  c: Context<AppEnv>,
  to: string,
  email: Email,
  onSent?: (messageId: string) => Promise<unknown>,
) {
  const sending = sendEmail(c.env, to, email).then((messageId) => (messageId && onSent ? onSent(messageId) : null));
  try {
    c.executionCtx.waitUntil(sending);
  } catch {
    // Sin ExecutionContext (tests con `app.request` sin contexto) la promesa sigue sola.
  }
}
