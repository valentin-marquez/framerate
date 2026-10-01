import {
  claimConfirmedEmail,
  claimExpiredEmail,
  claimInstructionsEmail,
  claimRevokedEmail,
  claimStaleEmail,
  type Email,
  render,
  storeInvitationEmail,
  ticketClosedEmail,
  ticketReceivedEmail,
  ticketReplyEmail,
} from "@framerate/emails";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

const meta = { title: "Correos", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * El correo tal como llega: el HTML renderizado en un iframe (el CSS del sitio no se mezcla), su asunto y la versión
 * en texto plano. Con `baseUrl` vacío las imágenes resuelven contra Storybook, que sirve `public/`.
 */
function EmailFrame({ email }: { email: Email }) {
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const [height, setHeight] = useState(600);

  useEffect(() => {
    render(email.element).then(setHtml);
    render(email.element, { plainText: true }).then(setText);
  }, [email]);

  return (
    <div className="w-[600px] max-w-full space-y-3">
      <p className="text-sm">
        <span className="text-muted-foreground">Asunto </span>
        <span className="font-medium">{email.subject}</span>
      </p>
      <iframe
        title={email.subject}
        srcDoc={html}
        onLoad={(e) => setHeight(e.currentTarget.contentDocument?.documentElement.scrollHeight ?? 600)}
        className="w-full rounded-xl border border-border bg-white"
        style={{ height: height + 2 }}
      />
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Texto plano</summary>
        <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-secondary p-4 font-mono text-xs">{text}</pre>
      </details>
    </div>
  );
}

const show = (email: Email) => () => <EmailFrame email={email} />;

const base = typeof window === "undefined" ? "" : window.location.origin;
const ticket = { ticketId: "FR-1042", subject: "No puedo reclamar mi tienda", baseUrl: base };
const anonymous = { kind: "anonymous", trackingUrl: "https://framerate.cl/soporte/FR-1042?t=9c1f7a2e44b8" } as const;
const claim = { storeName: "TecTec", storeSlug: "tectec", domain: "tectec.cl", baseUrl: base };
const txt = {
  txtName: "_framerate-verify.tectec.cl",
  txtValue: "framerate-verify=v1:8f3a2c91d07e4b6a9c55e1f0b3d2a7c4",
};
const longReply =
  "Hola, Ignacio. Revisamos el reclamo de TecTec y el registro TXT todavía no aparece en el DNS de tectec.cl.\n\nLos cambios pueden tardar hasta una hora en propagarse. Si después de eso sigue sin aparecer, revisa que el nombre sea exactamente _framerate-verify.tectec.cl: algunos paneles agregan el dominio solos y el registro queda como _framerate-verify.tectec.cl.tectec.cl.\n\nSi quieres, mándanos una captura del panel de tu proveedor y lo revisamos contigo.";

// Soporte

export const TicketRecibidoConCuenta: Story = {
  name: "Soporte: ticket recibido, con cuenta",
  render: show(
    ticketReceivedEmail({
      ...ticket,
      channel: { kind: "account" },
      category: "store_issue",
      message: "Agregué el registro TXT hace dos días y el reclamo sigue diciendo que no lo encuentra.",
    }),
  ),
};

export const TicketRecibidoSinCuenta: Story = {
  name: "Soporte: ticket recibido, sin cuenta",
  render: show(
    ticketReceivedEmail({
      ...ticket,
      subject: "Quiero que borren mis datos",
      channel: anonymous,
      category: "data_request",
      message: "Hola, quiero ejercer mi derecho a eliminar mis datos personales. Mi usuario era camila_r.",
    }),
  ),
};

export const TicketRecibidoPorCorreo: Story = {
  name: "Soporte: ticket recibido, por correo",
  render: show(
    ticketReceivedEmail({
      ...ticket,
      subject: "Precio equivocado en una RTX 4060",
      channel: { kind: "email" },
      category: "other",
      message:
        "Buenas, la RTX 4060 de PC Express aparece a $199.990 pero en la tienda está a $329.990.\n\nSaludos,\nPedro",
    }),
  ),
};

export const RespuestaConNombre: Story = {
  name: "Soporte: respuesta, con nombre y cuenta",
  render: show(
    ticketReplyEmail({
      ...ticket,
      channel: { kind: "account" },
      staffName: "Camila",
      status: "waiting_user",
      reply:
        "Hola, Ignacio. ¿Nos confirmas en qué proveedor tienes el DNS de tectec.cl? Así te damos los pasos exactos.",
    }),
  ),
};

export const RespuestaLargaSinCuenta: Story = {
  name: "Soporte: respuesta larga, sin nombre ni cuenta",
  render: show(
    ticketReplyEmail({ ...ticket, channel: anonymous, staffName: null, status: "in_progress", reply: longReply }),
  ),
};

export const RespuestaPorCorreo: Story = {
  name: "Soporte: respuesta, por correo",
  render: show(
    ticketReplyEmail({
      ...ticket,
      subject: "Precio equivocado en una RTX 4060",
      channel: { kind: "email" },
      staffName: "Ignacio",
      status: "resolved",
      reply: "Gracias por avisar, Pedro. Era un error de la tienda al publicar el precio y ya quedó corregido.",
    }),
  ),
};

export const TicketResuelto: Story = {
  name: "Soporte: ticket resuelto",
  render: show(ticketClosedEmail({ ...ticket, channel: { kind: "account" }, status: "resolved" })),
};

export const TicketCerradoPorCorreo: Story = {
  name: "Soporte: ticket cerrado, por correo",
  render: show(ticketClosedEmail({ ...ticket, channel: { kind: "email" }, status: "closed" })),
};

// Reclamo de tienda

export const InstruccionesConProveedor: Story = {
  name: "Reclamo: instrucciones, proveedor conocido",
  render: show(
    claimInstructionsEmail({ ...claim, ...txt, dnsProvider: "Cloudflare", expiresAt: "2026-10-08T15:00:00Z" }),
  ),
};

export const InstruccionesSinProveedor: Story = {
  name: "Reclamo: instrucciones, proveedor desconocido",
  render: show(claimInstructionsEmail({ ...claim, ...txt, dnsProvider: null, expiresAt: "2026-10-08T15:00:00Z" })),
};

export const ReclamoConfirmado: Story = {
  name: "Reclamo: tienda confirmada",
  render: show(claimConfirmedEmail(claim)),
};

export const ReclamoVencido: Story = {
  name: "Reclamo: vencido",
  render: show(claimExpiredEmail(claim)),
};

export const RegistroPerdido: Story = {
  name: "Reclamo: registro perdido, tienda congelada",
  render: show(claimStaleEmail({ ...claim, ...txt })),
};

export const RevocadoConMotivo: Story = {
  name: "Reclamo: revocado, con motivo",
  render: show(
    claimRevokedEmail({
      ...claim,
      reason: "El dominio cambió de dueño y el nuevo responsable de TecTec nos pidió revisar el reclamo.",
    }),
  ),
};

export const RevocadoSinMotivo: Story = {
  name: "Reclamo: revocado, sin motivo",
  render: show(claimRevokedEmail({ ...claim, reason: null })),
};

// Invitación

const invitation = {
  inviterName: "Ignacio Rojas",
  storeName: "TecTec",
  inviteeEmail: "camila@tectec.cl",
  acceptUrl: "https://framerate.cl/invitaciones/3f9c1b7e",
  expiresAt: "2026-10-08T15:00:00Z",
  baseUrl: base,
};

export const InvitacionEditor: Story = {
  name: "Invitación: editor",
  render: show(storeInvitationEmail({ ...invitation, role: "editor" })),
};

export const InvitacionAdministrador: Story = {
  name: "Invitación: administrador",
  render: show(storeInvitationEmail({ ...invitation, role: "admin" })),
};

// Bordes: nombres, dominios y mensajes largos, para ver cómo cortan.

export const ValoresLargos: Story = {
  name: "Bordes: valores largos",
  render: () => (
    <div className="flex flex-wrap gap-8">
      <EmailFrame
        email={ticketReceivedEmail({
          ...ticket,
          subject:
            "No me llegan las alertas de precio de la tarjeta de video que agregué a mi cotización hace una semana",
          channel: { kind: "account" },
          category: "bug",
          message: longReply.repeat(2),
        })}
      />
      <EmailFrame
        email={claimInstructionsEmail({
          storeName: "Distribuidora de Computación y Electrónica del Sur Limitada",
          storeSlug: "distribuidora-computacion-sur",
          domain: "tienda.distribuidoracomputacionyelectronicadelsur.cl",
          txtName: "_framerate-verify.tienda.distribuidoracomputacionyelectronicadelsur.cl",
          txtValue: txt.txtValue,
          dnsProvider: "Hostingplus",
          expiresAt: "2026-10-08T15:00:00Z",
          baseUrl: base,
        })}
      />
    </div>
  ),
};
