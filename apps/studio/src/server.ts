import { allowed } from "./guard";
import { login, run, status, type Target } from "./targets";
import index from "./ui/index.html";

const port = Number(process.env.PORT ?? 4983);

const server = Bun.serve({
  port,
  hostname: "127.0.0.1",
  // El runtime de HMR de Bun falla en Firefox/Zen (`new URL("")`) y deja la página en blanco.
  development: { hmr: false },
  routes: {
    "/": index,
    "/api/status": {
      POST: async (req) =>
        allowed(req, port)
          ? Response.json(await status())
          : Response.json({ error: "Origen no permitido" }, { status: 403 }),
    },
    "/api/login": {
      POST: async (req) =>
        allowed(req, port)
          ? Response.json(await login())
          : Response.json({ error: "Origen no permitido" }, { status: 403 }),
    },
    "/api/query": {
      POST: async (req) => {
        if (!allowed(req, port)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
        try {
          const { target, sql, params } = (await req.json()) as { target: Target; sql: string; params?: unknown[] };
          return Response.json(await run(target, sql, params ?? []));
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
        }
      },
    },
  },
});

console.log(`Framerate Studio en ${server.url}`);

const s = await status();
if (!s.remote.ok)
  console.log(
    `  Producción no disponible: ${s.remote.error}\n  Inicia sesión desde la página o con: bunx wrangler login`,
  );
if (!s.local.ok) console.log(`  Sin D1 local: ${s.local.error}`);
