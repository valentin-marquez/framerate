import { describe, expect, test } from "bun:test";
import { avatarUrl } from "./avatar";

describe("avatarUrl", () => {
  const source = "https://cdn.discordapp.com/avatars/1/abc.png";

  test("prefiere la copia propia cuando existe y hay base pública", () => {
    expect(
      avatarUrl({ avatar_key: "avatars/u1.webp", avatar_source_url: source }, "https://assets.framerate.cl/"),
    ).toBe("https://assets.framerate.cl/avatars/u1.webp");
  });

  test("sin copia propia (o sin base pública) usa la URL https del proveedor", () => {
    expect(avatarUrl({ avatar_key: null, avatar_source_url: source }, "https://assets.framerate.cl")).toBe(source);
    expect(avatarUrl({ avatar_key: "avatars/u1.webp", avatar_source_url: source })).toBe(source);
  });

  test("nunca expone URLs que no sean https, ni vacías", () => {
    expect(avatarUrl({ avatar_key: null, avatar_source_url: "http://cdn.example/a.png" })).toBeNull();
    expect(avatarUrl({ avatar_key: null, avatar_source_url: "javascript:alert(1)" })).toBeNull();
    expect(avatarUrl({ avatar_key: null, avatar_source_url: null })).toBeNull();
  });
});
