import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { color, font, mono } from "./theme";

/** Un correo listo para renderizar: `render(element)` da el HTML y `render(element, { plainText: true })` el texto. */
export interface Email {
  subject: string;
  element: ReactElement;
}

export const DEFAULT_BASE_URL = "https://framerate.cl";

const dateFormat = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Santiago",
});
/** "8 de octubre de 2026". */
export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

const paragraph: CSSProperties = {
  fontSize: 15,
  lineHeight: "24px",
  color: color.text,
  margin: "0 0 16px",
  overflowWrap: "anywhere",
};
const small: CSSProperties = { fontSize: 13, lineHeight: "20px", color: color.muted, margin: "0 0 8px" };
const mutedLink: CSSProperties = { color: color.muted, textDecoration: "underline" };

export function EmailLayout({
  baseUrl = DEFAULT_BASE_URL,
  preview,
  title,
  intro,
  action,
  note,
  whyReceived,
  card = false,
  children,
}: {
  /** Origen de las imágenes y enlaces; en Storybook, vacío para que resuelvan contra `public/`. */
  baseUrl?: string;
  preview: string;
  title: string;
  intro: ReactNode;
  action?: { label: string; href: string };
  note?: ReactNode;
  whyReceived: string;
  /** El contenido va en una tarjeta blanca sobre fondo gris (los correos de soporte). */
  card?: boolean;
  children?: ReactNode;
}) {
  const content = (
    <>
      <Text style={paragraph}>{intro}</Text>
      {children}
      {action && (
        <Section style={{ margin: "8px 0 4px" }}>
          <Button
            href={action.href}
            style={{
              backgroundColor: color.text,
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 10,
              padding: "12px 20px",
            }}
          >
            {action.label}
          </Button>
          <Text style={{ ...small, margin: "12px 0 0" }}>
            O copia este enlace en tu navegador:{" "}
            <Link href={action.href} style={mutedLink}>
              {action.href}
            </Link>
          </Text>
        </Section>
      )}
    </>
  );

  return (
    <Html lang="es">
      <Head>
        {/* Sólo claro: así Apple Mail no lo invierte a la fuerza en modo oscuro. */}
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: card ? color.page : color.card, fontFamily: font, margin: 0 }}>
        <Container style={{ maxWidth: 560, padding: "40px 24px" }}>
          <Img src={`${baseUrl}/email/logo.png`} width="32" height="32" alt="Framerate" />
          <Heading
            as="h1"
            style={{
              fontSize: 22,
              lineHeight: "30px",
              fontWeight: 700,
              color: color.text,
              margin: "28px 0 12px",
              overflowWrap: "anywhere",
            }}
          >
            {title}
          </Heading>
          {card ? (
            <Section
              style={{
                backgroundColor: color.card,
                border: `1px solid ${color.border}`,
                borderRadius: 16,
                padding: "24px 24px 20px",
              }}
            >
              {content}
            </Section>
          ) : (
            content
          )}
          {note && <Text style={{ ...small, margin: "20px 0 0" }}>{note}</Text>}
          <Hr style={{ borderColor: color.border, margin: "24px 0" }} />
          <Text style={small}>{whyReceived}</Text>
          <Text style={small}>
            ¿Dudas? Escríbenos a{" "}
            <Link href="mailto:soporte@framerate.cl" style={mutedLink}>
              soporte@framerate.cl
            </Link>
            .
          </Text>
          <Text style={{ ...small, margin: 0 }}>Framerate compara precios de hardware en Chile.</Text>
        </Container>
      </Body>
    </Html>
  );
}

/** Una sección con título opcional dentro del cuerpo. */
export function Block({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Section style={{ marginBottom: 20 }}>
      {title && <Text style={{ fontSize: 14, fontWeight: 600, color: color.text, margin: "0 0 10px" }}>{title}</Text>}
      {children}
    </Section>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={paragraph}>{children}</Text>;
}

/** Pares "etiqueta: valor" (n.º de ticket, tienda, dominio). */
export function Details({ items }: { items: Array<[label: string, value: ReactNode]> }) {
  return (
    <Section style={{ backgroundColor: color.page, borderRadius: 12, padding: "12px 16px" }}>
      {items.map(([label, value]) => (
        <Row key={label}>
          <Column style={{ width: 110, fontSize: 14, lineHeight: "28px", color: color.muted, verticalAlign: "top" }}>
            {label}
          </Column>
          <Column
            style={{
              fontSize: 14,
              lineHeight: "28px",
              color: color.text,
              verticalAlign: "top",
              overflowWrap: "anywhere",
            }}
          >
            {value}
          </Column>
        </Row>
      ))}
    </Section>
  );
}

/** Un valor que hay que copiar tal cual (el registro TXT). */
export function CodeValue({ label, value }: { label: string; value: string }) {
  return (
    <Section style={{ marginBottom: 12 }}>
      <Text style={{ ...small, margin: "0 0 6px" }}>{label}</Text>
      <Text
        style={{
          fontFamily: mono,
          fontSize: 13,
          lineHeight: "20px",
          color: color.text,
          backgroundColor: color.subtle,
          borderRadius: 8,
          padding: "10px 12px",
          margin: 0,
          wordBreak: "break-all",
        }}
      >
        {value}
      </Text>
    </Section>
  );
}

/** Texto de otra persona (la respuesta del equipo, el mensaje del ticket). Respeta los párrafos. */
export function Quote({ children }: { children: string }) {
  return (
    <Section style={{ borderLeft: `3px solid ${color.border}`, paddingLeft: 16 }}>
      {children.split(/\n{2,}/).map((block) => (
        <Text key={block} style={{ ...paragraph, whiteSpace: "pre-line" }}>
          {block}
        </Text>
      ))}
    </Section>
  );
}

export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <Section>
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: los pasos son fijos y no se reordenan
        <Row key={index}>
          <Column style={{ width: 28, fontSize: 15, lineHeight: "24px", color: color.muted, verticalAlign: "top" }}>
            {index + 1}.
          </Column>
          <Column
            style={{
              fontSize: 15,
              lineHeight: "24px",
              color: color.text,
              paddingBottom: 8,
              verticalAlign: "top",
              overflowWrap: "anywhere",
            }}
          >
            {item}
          </Column>
        </Row>
      ))}
    </Section>
  );
}
