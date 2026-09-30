/**
 * Verificación de propiedad de un dominio por registro TXT, consultando DNS-over-HTTPS a dos resolvers
 * independientes (Cloudflare y Google). Para dar por bueno el registro AMBOS deben verlo: un resolver
 * envenenado o con caché vieja no alcanza.
 */

export const CLAIM_TXT_PREFIX = "_framerate-verify";

export const claimTxtName = (domain: string) => `${CLAIM_TXT_PREFIX}.${domain}`;
export const claimTxtValue = (token: string) => `framerate-verify=v1:${token}`;

const RESOLVERS = {
  cloudflare: "https://cloudflare-dns.com/dns-query",
  google: "https://dns.google/resolve",
} as const;
type ResolverName = keyof typeof RESOLVERS;

const NXDOMAIN = 3;
const TYPE = { NS: 2, TXT: 16 } as const;

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

interface DohResponse {
  Status: number;
  Answer?: { type: number; data: string }[];
}

export interface ResolverResult {
  /** El resolver contestó (aunque sea "no existe"). */
  ok: boolean;
  status: number;
  records: string[];
}

async function query(resolver: ResolverName, name: string, type: keyof typeof TYPE, fetcher: Fetcher) {
  try {
    const res = await fetcher(`${RESOLVERS[resolver]}?name=${encodeURIComponent(name)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(4000),
    });
    return res.ok ? ((await res.json()) as DohResponse) : null;
  } catch {
    return null;
  }
}

/** Un TXT largo llega partido en trozos entre comillas (`"abc" "def"`): se unen. */
export const txtRecords = (response: DohResponse | null): string[] =>
  (response?.Answer ?? [])
    .filter((a) => a.type === TYPE.TXT)
    .map((a) =>
      a.data
        .split(/"\s+"/)
        .map((chunk) => chunk.replace(/^"|"$/g, ""))
        .join(""),
    );

const nsRecords = (response: DohResponse | null): string[] =>
  (response?.Answer ?? []).filter((a) => a.type === TYPE.NS).map((a) => a.data.replace(/\.$/, "").toLowerCase());

export type TxtCheckStatus = "verified" | "pending" | "mismatch" | "error";

export interface TxtCheck {
  status: TxtCheckStatus;
  /** Ambos resolvers contestaron: sólo entonces la ausencia del registro es una evidencia fiable. */
  conclusive: boolean;
  /** Registros TXT vistos por cualquiera de los dos (sin duplicados). */
  found: string[];
  resolvers: Record<ResolverName, ResolverResult>;
}

export async function checkTxt(name: string, expected: string, fetcher: Fetcher = fetch): Promise<TxtCheck> {
  const [cf, google] = await Promise.all([
    query("cloudflare", name, "TXT", fetcher),
    query("google", name, "TXT", fetcher),
  ]);
  const resolvers = {
    cloudflare: { ok: cf !== null, status: cf?.Status ?? -1, records: txtRecords(cf) },
    google: { ok: google !== null, status: google?.Status ?? -1, records: txtRecords(google) },
  };
  const found = [...new Set([...resolvers.cloudflare.records, ...resolvers.google.records])];
  const conclusive = resolvers.cloudflare.ok && resolvers.google.ok;
  const seenBy = [resolvers.cloudflare, resolvers.google].filter((r) => r.records.includes(expected)).length;

  let status: TxtCheckStatus;
  if (seenBy === 2) status = "verified";
  else if (seenBy === 1) status = "pending";
  else if (found.length > 0) status = "mismatch";
  else if (conclusive) status = "pending";
  else status = "error";

  return { status, conclusive, found, resolvers };
}

/** Patrones de nameserver → proveedor de DNS. Sólo mejora las instrucciones; un falso negativo no rompe nada. */
const NS_PROVIDERS: [id: string, pattern: RegExp][] = [
  ["cloudflare", /\.ns\.cloudflare\.com$/],
  ["route53", /\.awsdns-\d+\.(com|net|org|co\.uk)$/],
  ["gcdns", /\.googledomains\.com$/],
  ["vercel", /\.vercel-dns\.com$/],
  ["digitalocean", /\.digitalocean\.com$/],
  ["godaddy", /\.domaincontrol\.com$/],
  ["namecheap", /\.registrar-servers\.com$/],
  ["hostinger", /\.(hostinger\.com|hostingertest\.net)$/],
  ["azure", /\.azure-dns\.(com|net|org|info)$/],
  ["nic_cl", /\.nic\.cl$/],
  ["hostingplus_cl", /\.hostingplus\.(cl|com)$/],
  ["sered_cl", /\.sered\.net$/],
  ["bluehosting_cl", /\.bluehosting\.(cl|host)$/],
];

export const providerFromNameservers = (nameservers: string[]): string | null =>
  NS_PROVIDERS.find(([, pattern]) => nameservers.some((ns) => pattern.test(ns)))?.[0] ?? null;

export async function detectDnsProvider(domain: string, fetcher: Fetcher = fetch) {
  const [cf, google] = await Promise.all([
    query("cloudflare", domain, "NS", fetcher),
    query("google", domain, "NS", fetcher),
  ]);
  const nameservers = [...new Set([...nsRecords(cf), ...nsRecords(google)])].sort();
  return { provider: providerFromNameservers(nameservers), nameservers };
}
