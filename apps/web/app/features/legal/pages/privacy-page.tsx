import {
  IconClock,
  IconCookie,
  IconDatabase,
  IconGlobe,
  IconLock,
  IconShield,
  IconUserCheck,
  IconUserShield,
} from "@tabler/icons-react";
import { SupportContactPanel } from "~/features/support/components/support-contact-panel";
import { SUPPORT_EMAIL } from "~/features/support/services/support";

import type { Route } from "./+types/privacy-page";

export function meta(_: Route.MetaArgs) {
  const title = "Privacidad - Framerate";
  const description =
    "Qué datos guarda Framerate.cl, para qué los usa, con quién los comparte y cómo ejercer tus derechos sobre ellos.";

  return [
    { title },
    { name: "description", content: description },
    { property: "og:site_name", content: "Framerate.cl" },
    { property: "og:locale", content: "es_CL" },
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: "/og-image.png" },
    { name: "twitter:card", content: "summary" },
  ];
}

export default function Privacy() {
  const lastUpdate = "1 de octubre de 2026";

  return (
    <div className="container mx-auto max-w-4xl px-6 py-12 lg:py-20">
      <header className="mb-12 space-y-4">
        <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary tracking-tight">
          Protección de datos
        </div>
        <h1 className="text-4xl font-semibold tracking-tight lg:text-5xl">Política de privacidad</h1>
        <p className="text-muted-foreground">
          Última actualización: <span className="font-medium text-foreground">{lastUpdate}</span>
        </p>
      </header>

      <div className="grid gap-8">
        <div className="rounded-2xl border border-border bg-card p-8">
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <IconShield className="size-6 text-primary" />
              <h2 className="text-2xl font-semibold">Nuestro compromiso</h2>
            </div>
            <p className="leading-relaxed">
              Framerate.cl compara precios de componentes de PC en tiendas chilenas. Guardamos lo mínimo para que el
              servicio funcione, no vendemos tus datos ni los usamos para publicidad, y aquí te contamos qué pasa con lo
              que compartes.
            </p>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                  <IconUserShield className="size-4" /> Si creas una cuenta
                </h3>
                <p className="text-sm">
                  Entras con <span className="font-bold">Discord o Google</span>; no tenemos contraseñas propias. De tu
                  proveedor recibimos tu correo, tu nombre y tu foto de perfil. Con eso armamos tu perfil: un nombre de
                  usuario, un nombre visible y la foto, que son públicos en{" "}
                  <code className="bg-muted/10 px-1 rounded">/u/tu-usuario</code> junto con las reseñas que publiques.
                  Tu correo nunca se muestra.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                  <IconGlobe className="size-4" /> Si sólo navegas
                </h3>
                <p className="text-sm">
                  No necesitas cuenta. Cloudflare, donde funciona el sitio, procesa tu{" "}
                  <span className="font-bold">dirección IP</span> para entregarte las páginas, limitar el exceso de
                  peticiones y frenar abusos. Contamos cuántas veces se ve cada producto por día, como un total que no
                  identifica a nadie.
                </p>
              </div>
            </div>
          </section>
        </div>

        <section className="px-4 space-y-8">
          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <IconLock className="size-5 text-primary" /> Sesión y seguridad
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Al iniciar sesión guardamos la sesión con la IP y el navegador desde donde entraste, para mantenerte
              conectado y detectar accesos extraños. También guardamos lo que entrega Discord o Google para vincular tu
              cuenta: tu identificador en ese servicio y las credenciales de acceso que emite. Si entras con los dos,
              puedes unirlos en una sola cuenta.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <IconDatabase className="size-5 text-primary" /> Dónde viven tus datos
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              El sitio y la base de datos funcionan en <span className="font-bold">Cloudflare</span>. Cloudflare es una
              empresa de Estados Unidos, así que tus datos pueden procesarse fuera de Chile. Aparte de Cloudflare, y de
              Discord o Google para iniciar sesión, no compartimos tus datos con nadie.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <IconGlobe className="size-5 text-primary" /> Imágenes y enlaces a tiendas
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Las fotos de productos y los íconos de las tiendas se cargan directo desde el sitio de cada tienda, y las
              fotos de perfil desde Discord o Google. Cuando tu navegador las descarga, esos servidores reciben tu IP,
              como con cualquier imagen en internet. Los enlaces a una tienda llevan{" "}
              <code className="bg-muted/10 px-1 rounded">utm_source=framerate.cl</code> para que la tienda sepa que la
              visita vino de aquí. La compra ocurre en su sitio y se rige por su propia política de privacidad.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <IconUserCheck className="size-5 text-primary" /> Tiendas reclamadas
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Si reclamas una tienda, guardamos quién la reclamó, el dominio, el historial de la verificación por DNS y
              quiénes integran su equipo. La ficha pública muestra que la tienda está verificada; la lista del equipo no
              se publica.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <IconShield className="size-5 text-primary" /> Moderación
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Cuando el equipo de Framerate modera una reseña o una cuenta, registramos quién lo hizo, sobre qué y por
              qué. Ese registro es interno.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <IconCookie className="size-5 text-primary" /> Cookies
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Sólo cookies técnicas: la de tu sesión, tu idioma, tu tema (claro u oscuro) y tu zona horaria, para que la
              página llegue bien desde el servidor. No usamos cookies de publicidad ni herramientas de analítica de
              terceros.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <IconClock className="size-5 text-primary" /> Cuánto tiempo los guardamos
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Tus datos de cuenta, mientras la tengas. Las sesiones vencen solas. Si eliminamos tu cuenta, borramos tus
              datos personales (correo, nombres, foto, vínculos con Discord o Google y sesiones) y las reseñas que
              publicaste quedan sin tu nombre.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <IconUserShield className="size-5 text-primary" /> Tus derechos
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Tienes derecho de{" "}
              <span className="font-medium text-foreground">acceso, rectificación, cancelación y oposición</span> sobre
              tus datos personales (Ley 19.628 y, desde su entrada en vigencia, Ley 21.719). Para ejercerlos, escríbenos
              a{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-foreground underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              desde el correo de tu cuenta. Todavía no hay un botón para eliminar la cuenta; mientras llega, lo hacemos
              a mano.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Si cambiamos esta política, actualizamos la fecha de arriba.
            </p>
          </div>

          <SupportContactPanel defaultCategory="privacy" />
        </section>
      </div>
    </div>
  );
}
