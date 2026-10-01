import {
  Block,
  CodeValue,
  DEFAULT_BASE_URL,
  Details,
  type Email,
  EmailLayout,
  formatDate,
  Paragraph,
  Quote,
  Steps,
} from "./layout";

interface ClaimEmailProps {
  storeName: string;
  storeSlug: string;
  domain: string;
  baseUrl?: string;
}

const claimUrl = (baseUrl: string, storeSlug: string) => `${baseUrl}/reclamar?store=${encodeURIComponent(storeSlug)}`;
const storeAdminUrl = (baseUrl: string, storeSlug: string) =>
  `${baseUrl}/tiendas/${encodeURIComponent(storeSlug)}/admin`;

export function claimInstructionsEmail({
  storeName,
  storeSlug,
  domain,
  txtName,
  txtValue,
  dnsProvider,
  expiresAt,
  baseUrl = DEFAULT_BASE_URL,
}: ClaimEmailProps & {
  txtName: string;
  txtValue: string;
  /** Nombre del proveedor de DNS detectado (Cloudflare, NIC Chile…), o `null` si no se reconoció. */
  dnsProvider: string | null;
  expiresAt: string;
}): Email {
  return {
    subject: `Verifica ${domain} para reclamar ${storeName}`,
    element: (
      <EmailLayout
        baseUrl={baseUrl}
        preview={`Agrega un registro TXT en el DNS de ${domain} para reclamar ${storeName}.`}
        title={`Verifica que ${domain} es tuyo`}
        intro={`Para reclamar ${storeName} en Framerate, agrega este registro TXT en el DNS de ${domain}.`}
        action={{ label: "Ir al reclamo", href: claimUrl(baseUrl, storeSlug) }}
        note="Si no iniciaste este reclamo, ignora este correo: sin el registro TXT nadie puede tomar la tienda."
        whyReceived="Te llega porque iniciaste el reclamo de una tienda en Framerate."
      >
        <Block title="Registro TXT">
          <CodeValue label="Nombre" value={txtName} />
          <CodeValue label="Valor" value={txtValue} />
        </Block>
        <Block title="Qué sigue">
          <Steps
            items={[
              dnsProvider
                ? `Entra al panel de DNS de ${dnsProvider}, que es donde está el DNS de ${domain}.`
                : `Entra al panel donde administras el DNS de ${domain}: suele ser donde compraste el dominio o tu hosting.`,
              "Crea un registro TXT con el nombre y el valor de arriba.",
              "Vuelve al reclamo y aprieta Verificar. El cambio puede tardar unos minutos en verse.",
            ]}
          />
        </Block>
        <Block title="Detalle">
          <Details
            items={[
              ["Tienda", storeName],
              ["Dominio", domain],
              ["Vence", formatDate(expiresAt)],
            ]}
          />
        </Block>
      </EmailLayout>
    ),
  };
}

export function claimConfirmedEmail({
  storeName,
  storeSlug,
  domain,
  baseUrl = DEFAULT_BASE_URL,
}: ClaimEmailProps): Email {
  return {
    subject: `${storeName} ya es tuya en Framerate`,
    element: (
      <EmailLayout
        baseUrl={baseUrl}
        preview={`Confirmamos tu reclamo de ${storeName}.`}
        title={`${storeName} ya es tuya`}
        intro={`Confirmamos tu reclamo: ahora administras ${storeName} en Framerate.`}
        action={{ label: "Ir al panel de la tienda", href: storeAdminUrl(baseUrl, storeSlug) }}
        note={`Mantén el registro TXT en el DNS de ${domain}: lo revisamos cada 6 horas y, si desaparece, la tienda se congela hasta que vuelva.`}
        whyReceived="Te llega porque reclamaste una tienda en Framerate."
      >
        <Block>
          <Paragraph>
            Desde el panel puedes editar el perfil de la tienda, responder reseñas y sumar a tu equipo.
          </Paragraph>
        </Block>
      </EmailLayout>
    ),
  };
}

export function claimExpiredEmail({
  storeName,
  storeSlug,
  domain,
  baseUrl = DEFAULT_BASE_URL,
}: ClaimEmailProps): Email {
  return {
    subject: `Tu reclamo de ${storeName} venció`,
    element: (
      <EmailLayout
        baseUrl={baseUrl}
        preview={`Pasaron 7 días sin verificar el registro TXT de ${domain}.`}
        title={`Tu reclamo de ${storeName} venció`}
        intro={`Pasaron 7 días sin que pudiéramos verificar el registro TXT en el DNS de ${domain}, así que el reclamo venció.`}
        action={{ label: "Iniciar otro reclamo", href: claimUrl(baseUrl, storeSlug) }}
        note="Al iniciar otro reclamo te damos un registro TXT nuevo: el anterior ya no sirve."
        whyReceived="Te llega porque iniciaste el reclamo de una tienda en Framerate."
      />
    ),
  };
}

export function claimStaleEmail({
  storeName,
  storeSlug,
  domain,
  txtName,
  txtValue,
  baseUrl = DEFAULT_BASE_URL,
}: ClaimEmailProps & { txtName: string; txtValue: string }): Email {
  return {
    subject: `No encontramos el registro TXT de ${domain}`,
    element: (
      <EmailLayout
        baseUrl={baseUrl}
        preview={`${storeName} quedó congelada hasta que el registro TXT vuelva.`}
        title={`${storeName} quedó congelada`}
        intro={`En los últimos chequeos no encontramos el registro TXT en el DNS de ${domain}. Mientras no vuelva, la tienda queda congelada: nadie de tu equipo puede editarla.`}
        action={{ label: "Ver la tienda", href: storeAdminUrl(baseUrl, storeSlug) }}
        note="Si quitaste el registro a propósito y ya no quieres administrar la tienda, no tienes que hacer nada."
        whyReceived={`Te llega porque administras ${storeName} en Framerate.`}
      >
        <Block title="Registro que buscamos">
          <CodeValue label="Nombre" value={txtName} />
          <CodeValue label="Valor" value={txtValue} />
        </Block>
        <Block>
          <Paragraph>
            Si lo vuelves a agregar, la tienda se descongela sola en el próximo chequeo. Revisamos cada 6 horas.
          </Paragraph>
        </Block>
      </EmailLayout>
    ),
  };
}

export function claimRevokedEmail({
  storeName,
  storeSlug,
  domain,
  reason,
  baseUrl = DEFAULT_BASE_URL,
}: ClaimEmailProps & { reason: string | null }): Email {
  return {
    subject: `Revocamos tu reclamo de ${storeName}`,
    element: (
      <EmailLayout
        baseUrl={baseUrl}
        preview={`${storeName} ya no está vinculada a tu equipo.`}
        title={`Revocamos tu reclamo de ${storeName}`}
        intro={`Un administrador de Framerate revocó tu reclamo: ${storeName} ya no está vinculada a tu equipo y no puedes editarla.`}
        action={{ label: "Ver la tienda", href: `${baseUrl}/tiendas/${encodeURIComponent(storeSlug)}` }}
        note="Si crees que es un error, responde este correo y lo revisamos."
        whyReceived={`Te llega porque administrabas ${storeName} en Framerate.`}
      >
        {reason && (
          <Block title="Motivo">
            <Quote>{reason}</Quote>
          </Block>
        )}
        <Block title="Detalle">
          <Details
            items={[
              ["Tienda", storeName],
              ["Dominio", domain],
            ]}
          />
        </Block>
      </EmailLayout>
    ),
  };
}
