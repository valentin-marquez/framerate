// El endpoint corre SQL en producción con el login de quien lo usa: cualquier pestaña del navegador podría llamarlo.
// Host local frena el DNS rebinding; Origin propio y JSON (que obliga a preflight CORS) frenan el CSRF.
export function allowed(req: Request, port: number): boolean {
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  const origin = req.headers.get("origin");
  return (
    hosts.includes(req.headers.get("host") ?? "") &&
    (origin === null || hosts.some((h) => origin === `http://${h}`)) &&
    (req.headers.get("content-type") ?? "").startsWith("application/json")
  );
}
