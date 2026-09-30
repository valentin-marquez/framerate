import { describe, expect, test } from "bun:test";
import { buildSocialProviders, enabledProviders, PROVIDERS } from "./providers";

describe("registro de proveedores", () => {
  test("un proveedor se habilita sólo con sus DOS credenciales", () => {
    expect(enabledProviders({})).toEqual([]);
    expect(enabledProviders({ DISCORD_CLIENT_ID: "id" })).toEqual([]);
    expect(enabledProviders({ DISCORD_CLIENT_SECRET: "secret" })).toEqual([]);
    expect(enabledProviders({ DISCORD_CLIENT_ID: "", DISCORD_CLIENT_SECRET: "secret" })).toEqual([]);
    expect(enabledProviders({ DISCORD_CLIENT_ID: "id", DISCORD_CLIENT_SECRET: "secret" }).map((p) => p.id)).toEqual([
      "discord",
    ]);
  });

  test("agregar credenciales de otro proveedor lo habilita sin tocar código", () => {
    const env = {
      DISCORD_CLIENT_ID: "d",
      DISCORD_CLIENT_SECRET: "d",
      GOOGLE_CLIENT_ID: "g",
      GOOGLE_CLIENT_SECRET: "g",
    };
    expect(enabledProviders(env).map((p) => p.id)).toEqual(["discord", "google"]);
    expect(Object.keys(buildSocialProviders(env))).toEqual(["discord", "google"]);
  });

  test("las opciones llevan las credenciales de cada proveedor", () => {
    const social = buildSocialProviders({ GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsecret" });
    expect(social.google).toMatchObject({ clientId: "gid", clientSecret: "gsecret" });
  });

  test("Discord entrega su handle como candidato de username (la API lo normaliza)", () => {
    const options = buildSocialProviders({ DISCORD_CLIENT_ID: "d", DISCORD_CLIENT_SECRET: "s" }).discord;
    const map = options?.mapProfileToUser as (p: { username: string }) => { username: string };
    expect(map({ username: "Ana.Perez" })).toEqual({ username: "Ana.Perez" });
  });

  test("los ids son únicos (definen la ruta del callback)", () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
