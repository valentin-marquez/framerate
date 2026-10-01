import { Block, DEFAULT_BASE_URL, Details, type Email, EmailLayout, formatDate, Paragraph } from "./layout";

export type InvitationRole = "admin" | "editor";

const ROLE: Record<InvitationRole, { label: string; can: string }> = {
  admin: {
    label: "Administrador",
    can: "Como administrador puedes editar el perfil de la tienda, responder reseñas y sumar o quitar miembros.",
  },
  editor: { label: "Editor", can: "Como editor puedes editar el perfil de la tienda y responder reseñas." },
};

export function storeInvitationEmail({
  inviterName,
  storeName,
  role,
  inviteeEmail,
  acceptUrl,
  expiresAt,
  baseUrl = DEFAULT_BASE_URL,
}: {
  inviterName: string;
  storeName: string;
  role: InvitationRole;
  inviteeEmail: string;
  acceptUrl: string;
  expiresAt: string;
  baseUrl?: string;
}): Email {
  const { label, can } = ROLE[role];
  return {
    subject: `${inviterName} te invitó a ${storeName} en Framerate`,
    element: (
      <EmailLayout
        baseUrl={baseUrl}
        preview={`Súmate al equipo de ${storeName} como ${label.toLowerCase()}.`}
        title={`Te invitaron a ${storeName}`}
        intro={`${inviterName} te invitó a sumarte al equipo de ${storeName} en Framerate como ${label.toLowerCase()}.`}
        action={{ label: "Aceptar la invitación", href: acceptUrl }}
        note={`Esta invitación es para ${inviteeEmail}. Si no la esperabas, ignórala: sin aceptarla no pasa nada.`}
        whyReceived="Te llega porque alguien te invitó a una tienda en Framerate."
      >
        <Block>
          <Paragraph>{can}</Paragraph>
        </Block>
        <Block title="Detalle">
          <Details
            items={[
              ["Tienda", storeName],
              ["Rol", label],
              ["Vence", formatDate(expiresAt)],
            ]}
          />
        </Block>
      </EmailLayout>
    ),
  };
}
