// Sondea tiendas desde la red de Cloudflare (otra IP y otra huella TLS que la de una red residencial): qué responde
// cada URL a un `fetch` de Worker y si hay un desafío anti-bot. Sólo lee; no toca la base.
//   bunx wrangler dev --remote -c scripts/wrangler.probe.jsonc
//   curl "http://127.0.0.1:8797/?u=https://winpy.cl/&u=https://spdigital.cl/"
const UA = "FramerateBot/1.0 (+https://framerate.cl/bot; comparador de precios)";
const HINTS =
  /just a moment|verificando tu navegador|sgcaptcha|cf-chl|challenge-platform|sorry, you have been blocked|wp-json|cdn\.shopify|jumpseller|prestashop|vtex|woocommerce/gi;

export default {
  async fetch(req: Request) {
    const urls = new URL(req.url).searchParams.getAll("u");
    const out = [];
    for (const u of urls) {
      const started = Date.now();
      try {
        const res = await fetch(u, {
          headers: { "User-Agent": UA, Accept: "text/html,application/json;q=0.9,*/*;q=0.8" },
          redirect: "follow",
        });
        const text = await res.text();
        const hints: Record<string, number> = {};
        for (const m of text.matchAll(HINTS)) hints[m[0].toLowerCase()] = (hints[m[0].toLowerCase()] ?? 0) + 1;
        out.push({
          u,
          status: res.status,
          bytes: text.length,
          ms: Date.now() - started,
          server: res.headers.get("server"),
          title: text.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() ?? null,
          ldJson: (text.match(/application\/ld\+json/g) ?? []).length,
          hints,
          body: new URL(req.url).searchParams.has("body") ? text.slice(0, 300_000) : undefined,
        });
      } catch (e) {
        out.push({ u, error: String(e), ms: Date.now() - started });
      }
    }
    return Response.json(out, { headers: { "content-type": "application/json" } });
  },
};
