import { describe, expect, test } from "bun:test";
import { isMobileRequest, varyByDevice } from "./device";

const request = (headers: Record<string, string>) => new Request("https://framerate.cl/", { headers });

const ANDROID_PHONE =
  "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const GOOGLEBOT_MOBILE =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

describe("isMobileRequest", () => {
  test("teléfonos por user agent: Android con Mobile, iPhone y el Googlebot móvil", () => {
    for (const ua of [ANDROID_PHONE, IPHONE, GOOGLEBOT_MOBILE]) {
      expect(isMobileRequest(request({ "User-Agent": ua }))).toBe(true);
    }
  });

  test("escritorio y tabletas no son teléfono", () => {
    for (const ua of [DESKTOP, ANDROID_TABLET, IPAD]) {
      expect(isMobileRequest(request({ "User-Agent": ua }))).toBe(false);
    }
    expect(isMobileRequest(request({}))).toBe(false);
  });

  test("Sec-CH-UA-Mobile manda sobre el user agent, en los dos sentidos", () => {
    expect(isMobileRequest(request({ "Sec-CH-UA-Mobile": "?1", "User-Agent": DESKTOP }))).toBe(true);
    // "Sitio de escritorio" en un teléfono: el navegador avisa ?0 aunque el user agent sea de teléfono.
    expect(isMobileRequest(request({ "Sec-CH-UA-Mobile": "?0", "User-Agent": ANDROID_PHONE }))).toBe(false);
  });
});

describe("varyByDevice", () => {
  test("marca el HTML como variable por dispositivo y deja pasar el resto", () => {
    const html = varyByDevice(new Response("<p>", { headers: { "Content-Type": "text/html", Vary: "Accept" } }));
    expect(html.headers.get("Vary")).toBe("Accept, Sec-CH-UA-Mobile, User-Agent");
    const json = new Response("{}", { headers: { "Content-Type": "application/json" } });
    expect(varyByDevice(json)).toBe(json);
  });
});
