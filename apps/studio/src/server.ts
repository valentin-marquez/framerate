import { allowed } from "./guard";
import { run, type Target } from "./targets";
import index from "./ui/index.html";

const port = Number(process.env.PORT ?? 4983);

const server = Bun.serve({
  port,
  hostname: "127.0.0.1",
  development: true,
  routes: {
    "/": index,
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

console.log(`D1 Studio en ${server.url}`);
