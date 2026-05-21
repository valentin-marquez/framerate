/**
 * Detección de provider DNS a partir de los nameservers del dominio.
 *
 * Reutilizamos DoH (Cloudflare + Google en paralelo) para resolver NS records.
 * Matcheamos contra una tabla estática de patrones; si ningún provider matchea
 * devolvemos `null` y la UI cae a las instrucciones genéricas.
 *
 * El objetivo es UX, no seguridad: la tabla puede tener falsos negativos
 * (provider desconocido) sin romper el flujo de verificación.
 */

const CLOUDFLARE_DNS = "https://cloudflare-dns.com/dns-query";
const GOOGLE_DNS = "https://dns.google/resolve";

export type DnsProviderId =
  | "cloudflare"
  | "route53"
  | "gcdns"
  | "vercel"
  | "digitalocean"
  | "godaddy"
  | "namecheap"
  | "hostinger"
  | "azure"
  | "nic_cl"
  | "hostingplus_cl"
  | "sered_cl"
  | "bluehosting_cl";

export interface DnsProviderInfo {
  id: DnsProviderId;
  name: string;
  /** Deep link al panel de DNS del provider. No siempre podemos linkear a la
   * zona exacta (no tenemos zone-id sin OAuth); abrimos el listado. */
  dashboardUrl: string;
  /** Docs públicos para "agregar TXT record". */
  docsUrl?: string;
  /** Pasos cortos y atemporales para que no rote con cada rediseño de la UI. */
  steps: string[];
  /** Logo identifier; el front mapea a un asset/icono. */
  logoKey: string;
  /** Patterns de NS conocidos (lowercase, sin trailing dot). */
  nsPatterns: RegExp[];
}

export const DNS_PROVIDERS: DnsProviderInfo[] = [
  {
    id: "cloudflare",
    name: "Cloudflare",
    dashboardUrl: "https://dash.cloudflare.com/?to=/:account/:zone/dns/records",
    docsUrl: "https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/",
    logoKey: "cloudflare",
    nsPatterns: [/\.ns\.cloudflare\.com$/],
    steps: [
      "Entrá a tu zona en el dashboard de Cloudflare.",
      "Andá a DNS → Records y hacé click en Add record.",
      "Elegí Type: TXT, pegá el Name y el Content de abajo.",
      "Guardá. La propagación en Cloudflare suele ser instantánea.",
    ],
  },
  {
    id: "route53",
    name: "AWS Route 53",
    dashboardUrl: "https://console.aws.amazon.com/route53/v2/hostedzones",
    docsUrl: "https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-creating.html",
    logoKey: "route53",
    nsPatterns: [/\.awsdns-\d+\.(com|net|org|co\.uk)$/, /^ns-\d+\.awsdns-/],
    steps: [
      "Abrí Route 53 → Hosted zones y entrá a la zona del dominio.",
      "Create record → Record type TXT.",
      "Copiá el Name y el Value de abajo en el formulario.",
      "Create records y esperá ~1 minuto.",
    ],
  },
  {
    id: "gcdns",
    name: "Google Cloud DNS",
    dashboardUrl: "https://console.cloud.google.com/net-services/dns/zones",
    docsUrl: "https://cloud.google.com/dns/docs/records",
    logoKey: "gcdns",
    nsPatterns: [/\.googledomains\.com$/, /^ns-cloud-[a-z]\d?\.googledomains\.com$/],
    steps: [
      "Entrá a Cloud DNS → Zones y elegí tu zona.",
      "Add Standard → Resource record type: TXT.",
      "Pegá el DNS Name y el TXT data de abajo.",
      "Create. Propaga en segundos.",
    ],
  },
  {
    id: "vercel",
    name: "Vercel",
    dashboardUrl: "https://vercel.com/dashboard/domains",
    docsUrl: "https://vercel.com/docs/projects/domains/working-with-dns",
    logoKey: "vercel",
    nsPatterns: [/\.vercel-dns\.com$/],
    steps: [
      "Abrí Vercel → Domains y elegí tu dominio.",
      "DNS Records → Add → Type TXT.",
      "Pegá el Name y el Value de abajo.",
      "Save. Propaga en segundos.",
    ],
  },
  {
    id: "digitalocean",
    name: "DigitalOcean",
    dashboardUrl: "https://cloud.digitalocean.com/networking/domains",
    docsUrl: "https://docs.digitalocean.com/products/networking/dns/how-to/manage-records/",
    logoKey: "digitalocean",
    nsPatterns: [/\.digitalocean\.com$/, /^ns[1-3]\.digitalocean\.com$/],
    steps: [
      "Entrá a Networking → Domains y abrí tu dominio.",
      "En Create new record elegí TXT.",
      "Pegá el Hostname y el Value de abajo.",
      "Create Record.",
    ],
  },
  {
    id: "godaddy",
    name: "GoDaddy",
    dashboardUrl: "https://dcc.godaddy.com/manage/dns",
    docsUrl: "https://www.godaddy.com/help/add-a-txt-record-19232",
    logoKey: "godaddy",
    nsPatterns: [/\.domaincontrol\.com$/],
    steps: [
      "Entrá a My Products → DNS del dominio.",
      "Add → Type: TXT.",
      "Copiá el Host y el TXT Value de abajo (en Host usá lo que va antes del dominio).",
      "Save. Puede tardar hasta 1 hora.",
    ],
  },
  {
    id: "namecheap",
    name: "Namecheap",
    dashboardUrl: "https://ap.www.namecheap.com/domains/list/",
    docsUrl:
      "https://www.namecheap.com/support/knowledgebase/article.aspx/317/2237/how-do-i-add-txtspfdkimdmarc-records-for-my-domain/",
    logoKey: "namecheap",
    nsPatterns: [/\.registrar-servers\.com$/],
    steps: [
      "Entrá a Domain List → Manage → Advanced DNS.",
      "Add New Record → Type: TXT Record.",
      "Copiá el Host y el Value de abajo.",
      "Guardá con el tilde verde.",
    ],
  },
  {
    id: "hostinger",
    name: "Hostinger",
    dashboardUrl: "https://hpanel.hostinger.com/domains",
    docsUrl: "https://support.hostinger.com/en/articles/1583227-how-to-manage-dns-records-at-hostinger",
    logoKey: "hostinger",
    nsPatterns: [/\.hostinger\.com$/, /\.hostingertest\.net$/],
    steps: [
      "Entrá a hPanel → Domains → tu dominio → DNS / Nameservers.",
      "Add new record → Type TXT.",
      "Pegá el Name y el TXT Value de abajo.",
      "Save.",
    ],
  },
  {
    id: "azure",
    name: "Azure DNS",
    dashboardUrl:
      "https://portal.azure.com/#blade/HubsExtension/BrowseResource/resourceType/Microsoft.Network%2FdnsZones",
    docsUrl: "https://learn.microsoft.com/azure/dns/dns-operations-recordsets-portal",
    logoKey: "azure",
    nsPatterns: [/\.azure-dns\.(com|net|org|info)$/],
    steps: [
      "Abrí el portal de Azure → DNS zones → tu zona.",
      "+ Record set → Type TXT.",
      "Pegá el Name y el Value de abajo.",
      "OK.",
    ],
  },
  {
    id: "nic_cl",
    name: "NIC Chile",
    dashboardUrl: "https://www.nic.cl/registry/Login.do",
    docsUrl: "https://www.nic.cl/dnssec/registro-de-dns.html",
    logoKey: "nic_cl",
    nsPatterns: [/^ns\.nic\.cl$/, /\.nic\.cl$/],
    steps: [
      "Entrá a NIC Chile → ingresá con tu RUT y clave.",
      "Modificar datos → DNS del dominio.",
      "Importante: NIC.cl no permite TXT directamente; tenés que configurar tus propios servidores DNS o usar uno externo (Cloudflare gratis, por ejemplo).",
      "Si ya usás un DNS externo, agregá el TXT ahí y no en NIC.",
    ],
  },
  {
    id: "hostingplus_cl",
    name: "HostingPlus",
    dashboardUrl: "https://www.hostingplus.cl/cliente/clientarea.php",
    logoKey: "hostingplus_cl",
    nsPatterns: [/\.hostingplus\.cl$/, /\.hostingplus\.com$/],
    steps: [
      "Entrá al Área de Clientes de HostingPlus.",
      "Mis dominios → Administrar → DNS.",
      "Agregá un registro TXT con el Name y Value de abajo.",
      "Guardar cambios.",
    ],
  },
  {
    id: "sered_cl",
    name: "Sered",
    dashboardUrl: "https://www.sered.net/clientes/clientarea.php",
    logoKey: "sered_cl",
    nsPatterns: [/\.sered\.net$/],
    steps: [
      "Entrá al Área de Clientes de Sered.",
      "Mis dominios → Administrar → Gestión DNS.",
      "Añadir registro TXT con el Name y Value de abajo.",
      "Guardar.",
    ],
  },
  {
    id: "bluehosting_cl",
    name: "BlueHosting",
    dashboardUrl: "https://clientes.bluehosting.cl/clientarea.php",
    logoKey: "bluehosting_cl",
    nsPatterns: [/\.bluehosting\.(cl|host)$/],
    steps: [
      "Entrá al Área de Cliente de BlueHosting.",
      "Mis dominios → Administrar → Gestionar DNS.",
      "Agregá un TXT con el Name y Value de abajo.",
      "Guardar.",
    ],
  },
];

interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
}

async function fetchDoh(url: string): Promise<DohResponse | null> {
  try {
    const res = await fetch(url, { headers: { accept: "application/dns-json" } });
    if (!res.ok) return null;
    return (await res.json()) as DohResponse;
  } catch {
    return null;
  }
}

function extractNs(resp: DohResponse | null): string[] {
  if (!resp?.Answer) return [];
  return resp.Answer.filter((a) => a.type === 2)
    .map((a) => a.data.replace(/\.$/, "").toLowerCase())
    .filter((s) => s.length > 0);
}

function matchProvider(nameservers: string[]): DnsProviderInfo | null {
  if (nameservers.length === 0) return null;
  for (const provider of DNS_PROVIDERS) {
    const hit = nameservers.some((ns) => provider.nsPatterns.some((re) => re.test(ns)));
    if (hit) return provider;
  }
  return null;
}

export interface DetectDnsProviderResult {
  /** El provider matcheado (o null si desconocido / sin NS). */
  provider: DnsProviderInfo | null;
  /** NS records resueltos (dedupeados, lowercase, sin trailing dot). Vacío si falló DoH. */
  nameservers: string[];
}

/**
 * Resuelve NS records vía DoH paralelo y devuelve el provider matcheado.
 * Usa el primer set de NS disponible (Cloudflare gana si ambos respondieron);
 * los NS de un dominio no cambian entre resolvers.
 */
export async function detectDnsProvider(domain: string): Promise<DetectDnsProviderResult> {
  if (!domain) return { provider: null, nameservers: [] };

  const cfUrl = `${CLOUDFLARE_DNS}?name=${encodeURIComponent(domain)}&type=NS`;
  const googleUrl = `${GOOGLE_DNS}?name=${encodeURIComponent(domain)}&type=NS`;

  const [cf, g] = await Promise.all([fetchDoh(cfUrl), fetchDoh(googleUrl)]);

  const cfNs = extractNs(cf);
  const gNs = extractNs(g);
  const merged = Array.from(new Set([...cfNs, ...gNs])).sort();

  const provider = matchProvider(merged);
  return { provider, nameservers: merged };
}
