import type { Context } from "hono";
import type { AppEnv } from "@/app";
import { AppError } from "./errors";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(c: Context<AppEnv>, secret: string, token: string | undefined) {
  if (token) {
    const form = new URLSearchParams({ secret, response: token });
    const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-client-ip");
    if (ip) form.set("remoteip", ip);
    const res = await fetch(SITEVERIFY_URL, { method: "POST", body: form });
    const result = (await res.json().catch(() => ({}))) as { success?: boolean };
    if (result.success) return;
  }
  throw new AppError(400, "turnstile_failed", "No pudimos verificar que no eres un robot; intenta de nuevo");
}
