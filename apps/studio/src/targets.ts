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

let token: string | undefined;
const freshToken = async () => {
  token = (await $`bunx wrangler auth token`.cwd(root).quiet().text()).trim().split("\n").at(-1);
  return token;
};

async function remote(query: string, params: unknown[], retry = true): Promise<Result> {
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token ?? (await freshToken())}`, "content-type": "application/json" },
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
