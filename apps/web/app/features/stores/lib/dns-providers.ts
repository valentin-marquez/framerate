/**
 * Metadata visual de DNS providers para el wizard de reclamo.
 *
 * El backend (apps/api/src/lib/dns-provider.ts) sólo devuelve el `id` del
 * provider detectado; este archivo mapea ese id a lo que la UI necesita
 * (nombre, link al panel, color de marca, pasos). Si agregás un provider
 * en la API, agregalo acá también con el mismo id.
 */

import type { DnsProviderId } from "../services/claims";

export interface DnsProviderUi {
  id: DnsProviderId;
  name: string;
  dashboardUrl: string;
  docsUrl?: string;
  /** Color de marca (hex sin #) usado para el monograma del provider. */
  brandColor: string;
  /** Iniciales para el monograma (max 2 chars). */
  monogram: string;
  steps: string[];
}

export const DNS_PROVIDER_UI: Record<DnsProviderId, DnsProviderUi> = {
  cloudflare: {
    id: "cloudflare",
    name: "Cloudflare",
    dashboardUrl: "https://dash.cloudflare.com/",
    docsUrl: "https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/",
    brandColor: "F38020",
    monogram: "CF",
    steps: [
      "Entrá a tu zona en el dashboard de Cloudflare.",
      "Andá a DNS → Records y hacé click en Add record.",
      "Elegí Type: TXT, pegá el Name y el Content de abajo.",
      "Guardá. La propagación en Cloudflare suele ser instantánea.",
    ],
  },
  route53: {
    id: "route53",
    name: "AWS Route 53",
    dashboardUrl: "https://console.aws.amazon.com/route53/v2/hostedzones",
    docsUrl: "https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-creating.html",
    brandColor: "FF9900",
    monogram: "R53",
    steps: [
      "Abrí Route 53 → Hosted zones y entrá a la zona del dominio.",
      "Create record → Record type TXT.",
      "Copiá el Name y el Value de abajo en el formulario.",
      "Create records y esperá ~1 minuto.",
    ],
  },
  gcdns: {
    id: "gcdns",
    name: "Google Cloud DNS",
    dashboardUrl: "https://console.cloud.google.com/net-services/dns/zones",
    docsUrl: "https://cloud.google.com/dns/docs/records",
    brandColor: "4285F4",
    monogram: "GC",
    steps: [
      "Entrá a Cloud DNS → Zones y elegí tu zona.",
      "Add Standard → Resource record type: TXT.",
      "Pegá el DNS Name y el TXT data de abajo.",
      "Create. Propaga en segundos.",
    ],
  },
  vercel: {
    id: "vercel",
    name: "Vercel",
    dashboardUrl: "https://vercel.com/dashboard/domains",
    docsUrl: "https://vercel.com/docs/projects/domains/working-with-dns",
    brandColor: "000000",
    monogram: "VC",
    steps: [
      "Abrí Vercel → Domains y elegí tu dominio.",
      "DNS Records → Add → Type TXT.",
      "Pegá el Name y el Value de abajo.",
      "Save. Propaga en segundos.",
    ],
  },
  digitalocean: {
    id: "digitalocean",
    name: "DigitalOcean",
    dashboardUrl: "https://cloud.digitalocean.com/networking/domains",
    docsUrl: "https://docs.digitalocean.com/products/networking/dns/how-to/manage-records/",
    brandColor: "0080FF",
    monogram: "DO",
    steps: [
      "Entrá a Networking → Domains y abrí tu dominio.",
      "En Create new record elegí TXT.",
      "Pegá el Hostname y el Value de abajo.",
      "Create Record.",
    ],
  },
  godaddy: {
    id: "godaddy",
    name: "GoDaddy",
    dashboardUrl: "https://dcc.godaddy.com/manage/dns",
    docsUrl: "https://www.godaddy.com/help/add-a-txt-record-19232",
    brandColor: "1BDBDB",
    monogram: "GD",
    steps: [
      "Entrá a My Products → DNS del dominio.",
      "Add → Type: TXT.",
      "Copiá el Host y el TXT Value de abajo (en Host usá lo que va antes del dominio).",
      "Save. Puede tardar hasta 1 hora.",
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
    steps: [
      "Entrá a Domain List → Manage → Advanced DNS.",
      "Add New Record → Type: TXT Record.",
      "Copiá el Host y el Value de abajo.",
      "Guardá con el tilde verde.",
    ],
  },
  hostinger: {
    id: "hostinger",
    name: "Hostinger",
    dashboardUrl: "https://hpanel.hostinger.com/domains",
    docsUrl: "https://support.hostinger.com/en/articles/1583227-how-to-manage-dns-records-at-hostinger",
    brandColor: "673DE6",
    monogram: "HG",
    steps: [
      "Entrá a hPanel → Domains → tu dominio → DNS / Nameservers.",
      "Add new record → Type TXT.",
      "Pegá el Name y el TXT Value de abajo.",
      "Save.",
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
    steps: [
      "Abrí el portal de Azure → DNS zones → tu zona.",
      "+ Record set → Type TXT.",
      "Pegá el Name y el Value de abajo.",
      "OK.",
    ],
  },
  nic_cl: {
    id: "nic_cl",
    name: "NIC Chile",
    dashboardUrl: "https://www.nic.cl/registry/Login.do",
    docsUrl: "https://www.nic.cl/dnssec/registro-de-dns.html",
    brandColor: "0F4C81",
    monogram: "CL",
    steps: [
      "Entrá a NIC Chile → ingresá con tu RUT y clave.",
      "Modificar datos → DNS del dominio.",
      "Ojo: NIC.cl es sólo registrador, no provee TXT. Tenés que apuntar a un DNS externo (Cloudflare es gratis) y agregar el TXT ahí.",
      "Si ya usás un DNS externo, agregá el TXT ahí y no en NIC.",
    ],
  },
  hostingplus_cl: {
    id: "hostingplus_cl",
    name: "HostingPlus",
    dashboardUrl: "https://www.hostingplus.cl/cliente/clientarea.php",
    brandColor: "1E8FCD",
    monogram: "HP",
    steps: [
      "Entrá al Área de Clientes de HostingPlus.",
      "Mis dominios → Administrar → DNS.",
      "Agregá un registro TXT con el Name y Value de abajo.",
      "Guardar cambios.",
    ],
  },
  sered_cl: {
    id: "sered_cl",
    name: "Sered",
    dashboardUrl: "https://www.sered.net/clientes/clientarea.php",
    brandColor: "F26522",
    monogram: "SR",
    steps: [
      "Entrá al Área de Clientes de Sered.",
      "Mis dominios → Administrar → Gestión DNS.",
      "Añadir registro TXT con el Name y Value de abajo.",
      "Guardar.",
    ],
  },
  bluehosting_cl: {
    id: "bluehosting_cl",
    name: "BlueHosting",
    dashboardUrl: "https://clientes.bluehosting.cl/clientarea.php",
    brandColor: "1565C0",
    monogram: "BH",
    steps: [
      "Entrá al Área de Cliente de BlueHosting.",
      "Mis dominios → Administrar → Gestionar DNS.",
      "Agregá un TXT con el Name y Value de abajo.",
      "Guardar.",
    ],
  },
};

export function getDnsProviderUi(id: string | null | undefined): DnsProviderUi | null {
  if (!id) return null;
  return DNS_PROVIDER_UI[id as DnsProviderId] ?? null;
}
