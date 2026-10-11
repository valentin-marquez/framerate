import { Database } from "bun:sqlite";
import { $ } from "bun";

export type Target = "local" | "remote";
export type Result = { columns: string[]; rows: unknown[][]; meta?: Record<string, unknown> };

const root = `${import.meta.dir}/../../..`;
const cfg = Bun.JSONC.parse(await Bun.file(`${root}/packages/database/wrangler.jsonc`).text()) as {
  account_id: string;
  d1_databases: { database_id: string }[];
};
const url = `https://api.cloudflare.com/client/v4/accounts/${cfg.account_id}/d1/database/${cfg.d1_databases[0]?.database_id}/raw`;

export function runLocal(file: string, query: string, params: unknown[]): Result {
  const db = new Database(file);
  try {
    const stmt = db.prepare(query);
    return { columns: stmt.columnNames, rows: stmt.values(...(params as never[])) ?? [] };
  } finally {
    db.close();
  }
}

// La misma base que `bun run db:migrate:local`; miniflare la nombra con un hash.
const localFile = () => {
  const dir = `${root}/.wrangler/state/v3/d1/miniflare-D1DatabaseObject`;
  const f = [...new Bun.Glob("*.sqlite").scanSync(dir)].find((n) => n !== "metadata.sqlite");
  if (!f) throw new Error("No hay D1 local: corre `bun run db:migrate:local`.");
  return `${dir}/${f}`;
};

// Una sola petición del token aunque lleguen varias consultas a la vez (el tablero de inicio manda cinco).
let token: Promise<string | undefined> | undefined;
const freshToken = () => {
  token = $`bunx wrangler auth token`
    .cwd(root)
    .quiet()
    .text()
    .then((t) => t.trim().split("\n").at(-1))
    // Sin sesión, wrangler sale con error: la consulta sigue y D1 responde 401 con un mensaje claro.
    .catch(() => undefined);
  return token;
};

async function remote(query: string, params: unknown[], retry = true): Promise<Result> {
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${await (token ?? freshToken())}`, "content-type": "application/json" },
    body: JSON.stringify({ sql: query, params }),
  });
  const denied = res.status === 401 || res.status === 403;
  // El token OAuth de wrangler dura ~1 h: se pide otro una vez.
  if (denied && retry) {
    await freshToken();
    return remote(query, params, false);
  }
  const body = (await res.json()) as {
    success: boolean;
    errors?: { message: string }[];
    result?: { results: { columns: string[]; rows: unknown[][] }; meta: Record<string, unknown> }[];
  };
  if (!body.success) {
    const msg = body.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
    throw new Error(denied ? `${msg}. Corre \`bunx wrangler login\`.` : msg);
  }
  const last = body.result?.at(-1);
  return { columns: last?.results.columns ?? [], rows: last?.results.rows ?? [], meta: last?.meta };
}

export async function run(target: Target, query: string, params: unknown[]): Promise<Result> {
  if (target === "local") return runLocal(localFile(), query, params);
  if (target === "remote") return remote(query, params);
  throw new Error(`Destino desconocido: ${String(target)}`);
}

export type Check = { ok: boolean; error?: string };

// Lo que se revisa al abrir: si hay sesión de Cloudflare con acceso a la base y si existe la D1 local.
export async function status(): Promise<{ remote: Check; local: Check }> {
  const check = async (fn: () => unknown): Promise<Check> => {
    try {
      await fn();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };
  return {
    remote: await check(() => remote("select 1", [])),
    local: await check(() => localFile()),
  };
}

// Abre el login OAuth de wrangler en el navegador de quien corre el studio y espera a que termine.
export async function login(): Promise<Check> {
  const proc = Bun.spawn(["bunx", "wrangler", "login"], { cwd: root, stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  await freshToken();
  return code === 0 ? { ok: true } : { ok: false, error: `wrangler login terminó con código ${code}` };
}
