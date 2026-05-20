/**
 * DNS-over-HTTPS resolver (Cloudflare + Google) para verificación de TXT.
 *
 * Diseño:
 *  - Resolvemos en paralelo contra ambos proveedores.
 *  - Para considerar verificado, AMBOS deben retornar el token esperado.
 *    Esto mitiga DNS spoofing local y propagación inconsistente.
 *  - NXDOMAIN (Status=3) se trata como "todavía no, reintenta" (no error fatal).
 *
 * NOTA: Esta es una copia local de apps/api/src/lib/doh.ts. No se puede importar
 * desde apps/api/ porque ese app corre en Cloudflare Workers (otro deployment target).
 */

export interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

export interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
}

const CLOUDFLARE_DNS = "https://cloudflare-dns.com/dns-query";
const GOOGLE_DNS = "https://dns.google/resolve";

async function fetchDoh(url: string): Promise<DohResponse | null> {
  try {
    const res = await fetch(url, { headers: { accept: "application/dns-json" } });
    if (!res.ok) return null;
    return (await res.json()) as DohResponse;
  } catch {
    return null;
  }
}

function extractTxtRecords(resp: DohResponse | null): string[] {
  if (!resp?.Answer) return [];
  return resp.Answer.filter((a) => a.type === 16) // TXT
    .map((a) => {
      // DoH JSON returns each record as a quoted string, sometimes con multiple
      // chunks. Unescape outer quotes y concat chunks separados por `" "`.
      const raw = a.data;
      return raw
        .split(/"\s+"/)
        .map((chunk) => chunk.replace(/^"|"$/g, ""))
        .join("");
    });
}

export interface VerifyDnsResult {
  matched: boolean;
  status: "verified" | "pending" | "mismatch" | "error";
  details: {
    cloudflare: { ok: boolean; status: number; records: string[] };
    google: { ok: boolean; status: number; records: string[] };
  };
}

/**
 * Verifica si AMBOS resolvers ven el token TXT esperado.
 */
export async function verifyTxtRecord(name: string, expectedValue: string): Promise<VerifyDnsResult> {
  const cfUrl = `${CLOUDFLARE_DNS}?name=${encodeURIComponent(name)}&type=TXT`;
  const googleUrl = `${GOOGLE_DNS}?name=${encodeURIComponent(name)}&type=TXT`;

  const [cf, g] = await Promise.all([fetchDoh(cfUrl), fetchDoh(googleUrl)]);

  const cfRecords = extractTxtRecords(cf);
  const gRecords = extractTxtRecords(g);

  const cfMatch = cfRecords.includes(expectedValue);
  const gMatch = gRecords.includes(expectedValue);

  const cfStatus = cf?.Status ?? -1;
  const gStatus = g?.Status ?? -1;

  const details = {
    cloudflare: { ok: !!cf, status: cfStatus, records: cfRecords },
    google: { ok: !!g, status: gStatus, records: gRecords },
  };

  if (cfMatch && gMatch) {
    return { matched: true, status: "verified", details };
  }

  // NXDOMAIN en ambos: el TXT todavía no existe o no propagó.
  if (cfStatus === 3 && gStatus === 3) {
    return { matched: false, status: "pending", details };
  }

  // Si encontramos TXTs pero ninguno matchea, es mismatch (token incorrecto o rotado).
  if ((cfRecords.length > 0 || gRecords.length > 0) && !cfMatch && !gMatch) {
    return { matched: false, status: "mismatch", details };
  }

  // Caso parcial: uno matchea, el otro no propagó. Sigue pending.
  if (cfMatch !== gMatch) {
    return { matched: false, status: "pending", details };
  }

  return { matched: false, status: "error", details };
}
