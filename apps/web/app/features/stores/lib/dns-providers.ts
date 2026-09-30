/**
 * Metadata visual de DNS providers para el wizard de reclamo.
 *
 * El backend (apps/api/src/lib/dns-provider.ts) sólo devuelve el `id` del
 * provider detectado; este archivo mapea ese id a lo que la UI necesita
 * (nombre, link al panel, logo, pasos). Si se agrega un provider en la API,
 * hay que agregarlo acá también con el mismo id.
 */

import type { DnsProviderId } from "../services/claims";

export interface DnsProviderUi {
  id: DnsProviderId;
  name: string;
  /** Link al panel DNS del proveedor. Función cuando podemos deep-linkear
   * directo a la zona del dominio; string para el dashboard genérico. */
  dashboardUrl: string | ((domain: string) => string);
  docsUrl?: string;
  /** Color de marca (hex sin #), usado para el monograma cuando no hay logo. */
  brandColor: string;
  /** Iniciales para el monograma (fallback cuando no hay `logo`). */
  monogram: string;
  /** Nombre de archivo del logo en `public/dns-providers/`. Si falta, la UI
   * cae al monograma con color de marca. */
  logo?: string;
  steps: string[];
}

export const DNS_PROVIDER_UI: Record<DnsProviderId, DnsProviderUi> = {
  cloudflare: {
    id: "cloudflare",
    name: "Cloudflare",
    // Deep-link directo a DNS → Records de la zona. Cloudflare resuelve
    // `:account` solo; si el usuario tiene varias cuentas puede caer al
    // listado, pero igual es mejor que el dashboard raíz.
    dashboardUrl: (domain) => `https://dash.cloudflare.com/?to=/:account/${domain}/dns/records`,
    docsUrl: "https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/",
    brandColor: "F38020",
    monogram: "CF",
    logo: "cloudflare.png",
    steps: [
      "Entra a tu zona en el panel de Cloudflare.",
      "Ve a DNS → Records y haz clic en Add record.",
      "Elige Type: TXT y pega el Name y el Content de abajo.",
      "Guarda. En Cloudflare la propagación suele ser instantánea.",
    ],
  },
  route53: {
    id: "route53",
    name: "AWS Route 53",
    dashboardUrl: "https://console.aws.amazon.com/route53/v2/hostedzones",
    docsUrl: "https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-creating.html",
    brandColor: "FF9900",
    monogram: "R53",
    logo: "route53.svg",
    steps: [
      "Abre Route 53 → Hosted zones y entra a la zona del dominio.",
      "Create record → Record type TXT.",
      "Copia el Name y el Value de abajo en el formulario.",
      "Haz clic en Create records y espera ~1 minuto.",
    ],
  },
  gcdns: {
    id: "gcdns",
    name: "Google Cloud DNS",
    dashboardUrl: "https://console.cloud.google.com/net-services/dns/zones",
    docsUrl: "https://cloud.google.com/dns/docs/records",
    brandColor: "4285F4",
    monogram: "GC",
    logo: "gcdns.svg",
    steps: [
      "Entra a Cloud DNS → Zones y elige tu zona.",
      "Add Standard → Resource record type: TXT.",
      "Pega el DNS Name y el TXT data de abajo.",
      "Haz clic en Create. Propaga en segundos.",
    ],
  },
  vercel: {
    id: "vercel",
    name: "Vercel",
    dashboardUrl: "https://vercel.com/dashboard/domains",
    docsUrl: "https://vercel.com/docs/projects/domains/working-with-dns",
    brandColor: "000000",
    monogram: "VC",
    logo: "vercel.svg",
    steps: [
      "Abre Vercel → Domains y elige tu dominio.",
      "DNS Records → Add → Type TXT.",
      "Pega el Name y el Value de abajo.",
      "Haz clic en Save. Propaga en segundos.",
    ],
  },
  digitalocean: {
    id: "digitalocean",
    name: "DigitalOcean",
    dashboardUrl: "https://cloud.digitalocean.com/networking/domains",
    docsUrl: "https://docs.digitalocean.com/products/networking/dns/how-to/manage-records/",
    brandColor: "0080FF",
    monogram: "DO",
    logo: "digitalocean.svg",
    steps: [
      "Entra a Networking → Domains y abre tu dominio.",
      "En Create new record elige TXT.",
      "Pega el Hostname y el Value de abajo.",
      "Haz clic en Create Record.",
    ],
  },
  godaddy: {
    id: "godaddy",
    name: "GoDaddy",
    dashboardUrl: "https://dcc.godaddy.com/manage/dns",
    docsUrl: "https://www.godaddy.com/help/add-a-txt-record-19232",
    brandColor: "1BDBDB",
    monogram: "GD",
    logo: "godaddy.svg",
    steps: [
      "Entra a My Products → DNS del dominio.",
      "Add → Type: TXT.",
      "Copia el Host y el TXT Value de abajo (en Host usa lo que va antes del dominio).",
      "Haz clic en Save. Puede tardar hasta 1 hora.",
    ],
  },
  namecheap: {
    id: "namecheap",
    name: "Namecheap",
    dashboardUrl: "https://ap.www.namecheap.com/domains/list/",
    docsUrl:
      "https://www.namecheap.com/support/knowledgebase/article.aspx/317/2237/how-do-i-add-txtspfdkimdmarc-records-for-my-domain/",
    brandColor: "DE3910",
    monogram: "NC",
    logo: "namecheap.svg",
    steps: [
      "Entra a Domain List → Manage → Advanced DNS.",
      "Add New Record → Type: TXT Record.",
      "Copia el Host y el Value de abajo.",
      "Guarda con el check verde.",
    ],
  },
  hostinger: {
    id: "hostinger",
    name: "Hostinger",
    dashboardUrl: "https://hpanel.hostinger.com/domains",
    docsUrl: "https://support.hostinger.com/en/articles/1583227-how-to-manage-dns-records-at-hostinger",
    brandColor: "673DE6",
    monogram: "HG",
    logo: "hostinger.svg",
    steps: [
      "Entra a hPanel → Domains → tu dominio → DNS / Nameservers.",
      "Add new record → Type TXT.",
      "Pega el Name y el TXT Value de abajo.",
      "Haz clic en Save.",
    ],
  },
  azure: {
    id: "azure",
    name: "Azure DNS",
    dashboardUrl:
      "https://portal.azure.com/#blade/HubsExtension/BrowseResource/resourceType/Microsoft.Network%2FdnsZones",
    docsUrl: "https://learn.microsoft.com/azure/dns/dns-operations-recordsets-portal",
    brandColor: "0078D4",
    monogram: "AZ",
    logo: "azure.svg",
    steps: [
      "Abre el portal de Azure → DNS zones → tu zona.",
      "+ Record set → Type TXT.",
      "Pega el Name y el Value de abajo.",
      "Haz clic en OK.",
    ],
  },
  nic_cl: {
    id: "nic_cl",
    name: "NIC Chile",
    dashboardUrl: "https://www.nic.cl/registry/Login.do",
    docsUrl: "https://www.nic.cl/dnssec/registro-de-dns.html",
    brandColor: "0F4C81",
    monogram: "CL",
    logo: "nic_cl.png",
    steps: [
      "Entra a NIC Chile con tu RUT y clave.",
      "Modificar datos → DNS del dominio.",
      "Ojo: NIC.cl es sólo registrador, no provee TXT. Tienes que apuntar a un DNS externo (Cloudflare es gratis) y agregar el TXT ahí.",
      "Si ya usas un DNS externo, agrega el TXT ahí y no en NIC.",
    ],
  },
  hostingplus_cl: {
    id: "hostingplus_cl",
    name: "HostingPlus",
    dashboardUrl: "https://www.hostingplus.cl/cliente/clientarea.php",
    brandColor: "1E8FCD",
    monogram: "HP",
    steps: [
      "Entra al Área de Clientes de HostingPlus.",
      "Mis dominios → Administrar → DNS.",
      "Agrega un registro TXT con el Name y el Value de abajo.",
      "Guardar cambios.",
    ],
  },
  sered_cl: {
    id: "sered_cl",
    name: "Sered",
    dashboardUrl: "https://www.sered.net/clientes/clientarea.php",
    brandColor: "F26522",
    monogram: "SR",
    logo: "sered_cl.ico",
    steps: [
      "Entra al Área de Clientes de Sered.",
      "Mis dominios → Administrar → Gestión DNS.",
      "Agrega un registro TXT con el Name y el Value de abajo.",
      "Guardar.",
    ],
  },
  bluehosting_cl: {
    id: "bluehosting_cl",
    name: "BlueHosting",
    dashboardUrl: "https://clientes.bluehosting.cl/clientarea.php",
    brandColor: "1565C0",
    monogram: "BH",
    logo: "bluehosting_cl.png",
    steps: [
      "Entra al Área de Cliente de BlueHosting.",
      "Mis dominios → Administrar → Gestionar DNS.",
      "Agrega un TXT con el Name y el Value de abajo.",
      "Guardar.",
    ],
  },
};

export function getDnsProviderUi(id: string | null | undefined): DnsProviderUi | null {
  if (!id) return null;
  return DNS_PROVIDER_UI[id as DnsProviderId] ?? null;
}
