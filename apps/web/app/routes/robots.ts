import type { LoaderFunctionArgs } from "react-router";

// Cloudflare bloquea además a los bots de entrenamiento (AI Crawl Control), pero su Bot Preference Sync no llega a este
// archivo porque lo sirve el Worker: las Content Signals tienen que ir acá. Google-Extended y Applebot-Extended no
// rastrean; sólo existen en robots.txt para decidir el uso en entrenamiento.
export const loader = ({ request }: LoaderFunctionArgs) => {
  const { origin } = new URL(request.url);

  const robotText = `
# Los buscadores y asistentes de IA pueden usar Framerate para responder y citarlo, no para entrenar modelos.
# Content Signals: https://contentsignals.org
User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=no
Allow: /
Disallow: /admin
Disallow: /ajustes
Disallow: /perfil
Disallow: /soporte/
Disallow: /action/
Disallow: /tiendas/*/admin

User-agent: GPTBot
User-agent: ClaudeBot
User-agent: CCBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: Bytespider
User-agent: Amazonbot
User-agent: Meta-ExternalAgent
Disallow: /

Sitemap: ${origin}/sitemap.xml
`.trim();

  return new Response(robotText, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
