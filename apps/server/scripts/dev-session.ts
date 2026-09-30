import { createDb } from "@framerate/database";
import { testUtils } from "better-auth/plugins";
import { getPlatformProxy } from "wrangler";
import type { Env } from "../src/env";
import { createAuth } from "../src/features/identity/auth";

/** Crea (o reutiliza) un usuario en la D1 local y imprime la cabecera `Cookie` de una sesión válida. */
const [name = "Dev", role = "user"] = process.argv.slice(2);

const { env, dispose } = await getPlatformProxy<Env>({ persist: { path: ".wrangler/state/v3" } });
const db = createDb(env.DB);
const email = `${name.toLowerCase().replace(/\W+/g, "")}@local.dev`;

let user = await db.query.selectFrom("users").select("id").where("email", "=", email).executeTakeFirst();
if (!user) {
  const ctx = await createAuth(env).$context;
  const created = await ctx.internalAdapter.createOAuthUser(
    { email, name, emailVerified: true, image: null } as never,
    { providerId: "discord", accountId: crypto.randomUUID() } as never,
  );
  user = { id: created.user.id };
}
await db.query
  .updateTable("users")
  .set({ role: role as "user" })
  .where("id", "=", user.id)
  .execute();

const auth = createAuth(env, { plugins: [testUtils()] });
const test = ((await auth.$context) as unknown as { test: { getAuthHeaders(o: { userId: string }): Promise<Headers> } })
  .test;
console.log((await test.getAuthHeaders({ userId: user.id })).get("cookie"));
await dispose();
