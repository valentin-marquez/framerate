/**
 * Normalización de dominios para claims.
 *
 * No usamos PSL completo (sería un asset enorme en Workers). Aplicamos una
 * heurística: strippeamos `www.`, lowercase, y validamos contra una regex
 * de host. Para multi-label TLDs (.co.uk, .cl ok) confiamos en el TXT estar
 * en el host registrable que el usuario controla; el usuario es responsable
 * de pegar el dominio correcto. La unique key sobre claimed_domain evita
 * registros duplicados.
 */

const HOST_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function normalizeDomain(input: string): string | null {
  if (typeof input !== "string") return null;
  let host = input.trim().toLowerCase();

  // Strip protocolo y path si el usuario pegó una URL
  try {
    if (host.includes("://")) {
      const u = new URL(host);
      host = u.hostname;
    } else if (host.includes("/")) {
      host = host.split("/")[0] ?? host;
    }
  } catch {
    // ignore
  }

  // Strip leading www.
  host = host.replace(/^www\./, "");
  // Strip trailing dot
  host = host.replace(/\.$/, "");
  // Strip puerto
  host = host.replace(/:\d+$/, "");

  if (!HOST_RE.test(host)) return null;
  return host;
}

const HEX = "0123456789abcdef";

export function generateToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) {
    out += HEX[(b >> 4) & 0xf] + HEX[b & 0xf];
  }
  return `v1:${out}`;
}

export function txtRecordName(domain: string): string {
  return `_framerate-verify.${domain}`;
}

export function txtRecordValue(token: string): string {
  return `framerate-verify=${token}`;
}
