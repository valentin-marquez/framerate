import type { Email } from "@framerate/emails";
import { createLogger } from "@framerate/kit";
import type { Env } from "@/env";

const SUPPORT_ADDRESS = "soporte@framerate.cl";
const log = createLogger({ feature: "email" });

const loadTemplates = () => import("@framerate/emails");
export type Templates = Awaited<ReturnType<typeof loadTemplates>>;
export type Mailer = (to: string, build: (t: Templates) => Email) => Promise<unknown>;

/**
 * Envío de correos del Cron. Nunca lanza: un correo que falla queda en el log y no tumba el mantenimiento.
 * ponytail: copia de apps/server/src/shared/email.ts (las apps no se importan); moverlo a un paquete si aparece un tercer consumidor.
 */
export const emailSender =
  (env: Env): Mailer =>
  async (to, build) => {
    if (!env.EMAIL) return null;
    let subject: string | undefined;
    try {
      const templates = await loadTemplates();
      const email = build(templates);
      subject = email.subject;
      const [html, text] = await Promise.all([
        templates.render(email.element),
        templates.render(email.element, { plainText: true }),
      ]);
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
      log.error("email_failed", { error, subject });
      return null;
    }
  };
