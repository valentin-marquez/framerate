import type { Email } from "@framerate/emails";
import { createLogger } from "@framerate/kit";
import type { Context } from "hono";
import type { AppEnv } from "@/app";
import type { Env } from "@/env";

export const SUPPORT_ADDRESS = "soporte@framerate.cl";
const log = createLogger({ feature: "email" });

/**
 * Las plantillas arrastran react-dom, prettier y compañía (~1 MB): se cargan al enviar el primer correo del isolate
 * y no en cada arranque en frío del Worker, que es lo que paga el primer visitante.
 */
const loadTemplates = () => import("@framerate/emails");
export type Templates = Awaited<ReturnType<typeof loadTemplates>>;

/**
 * Envía un correo de `@framerate/emails` y devuelve su Message-ID. Nunca lanza: un correo que falla queda en el log
 * y no tumba lo que lo originó. Sin binding (tests) no envía nada.
 */
export async function sendEmail(env: Env, to: string, build: (t: Templates) => Email): Promise<string | null> {
  if (!env.EMAIL) {
    log.info("email_skipped");
    return null;
  }
  let subject: string | undefined;
  try {
    const templates = await loadTemplates();
    const { render } = templates;
    const email = build(templates);
    subject = email.subject;
    const element = email.element;
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
  build: (t: Templates) => Email,
  onSent?: (messageId: string) => Promise<unknown>,
) {
  const sending = sendEmail(c.env, to, build).then((messageId) => (messageId && onSent ? onSent(messageId) : null));
  try {
    c.executionCtx.waitUntil(sending);
  } catch {
    // Sin ExecutionContext (tests con `app.request` sin contexto) la promesa sigue sola.
  }
}
