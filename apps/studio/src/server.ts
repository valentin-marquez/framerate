import { run, type Target } from "./targets";
import index from "./ui/index.html";

// Sólo 127.0.0.1: este endpoint ejecuta SQL arbitrario en producción con el login de quien lo corre.
const server = Bun.serve({
  port: Number(process.env.PORT ?? 4983),
  hostname: "127.0.0.1",
  development: true,
  routes: {
    "/": index,
    "/api/query": {
      POST: async (req) => {
        const { target, sql, params } = (await req.json()) as { target: Target; sql: string; params?: unknown[] };
        try {
          return Response.json(await run(target, sql, params ?? []));
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
        }
      },
    },
  },
});

console.log(`D1 Studio en ${server.url}`);
