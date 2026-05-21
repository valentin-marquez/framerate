import {
  IconCookie,
  IconDatabase,
  IconGlobe,
  IconLock,
  IconShield,
  IconUserCheck,
  IconUserShield,
} from "@tabler/icons-react";
import { SupportContactPanel } from "~/features/support/components/support-contact-panel";

import type { Route } from "./+types/privacy-page";

export function meta(_: Route.MetaArgs) {
  const title = "Privacidad - Framerate";
  const description =
    "Qué datos guarda Framerate.cl, cómo los usa y los derechos ARCO de los usuarios chilenos. Política de privacidad actualizada.";

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
  const lastUpdate = "20 de mayo de 2026";

  return (
    <div className="container mx-auto max-w-4xl px-6 py-12 lg:py-20">
      <header className="mb-12 space-y-4">
        <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary tracking-tight">
          Protección de datos
        </div>
        <h1 className="text-4xl font-semibold tracking-tight lg:text-5xl">Política de Privacidad</h1>
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
              Framerate.cl agrega y compara precios de componentes de PC en Chile. Recopilamos los datos mínimos para
              que el servicio funcione, no vendemos información a terceros y queremos que sepas qué pasa con lo que
              compartís acá.
            </p>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                  <IconUserShield className="size-4" /> Cuenta y perfil
                </h3>
                <p className="text-sm">
                  Iniciás sesión vía <span className="font-bold">Discord, Google, Apple o Facebook</span> usando
                  Supabase Auth. Guardamos tu ID de usuario, email, nombre público, username y avatar para que puedas
                  comentar, dejar reseñas y armar cotizaciones. Tu username y avatar son visibles en{" "}
                  <code className="bg-muted/10 px-1 rounded">/u/:username</code>.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                  <IconGlobe className="size-4" /> Datos técnicos
                </h3>
                <p className="text-sm">
                  Cloudflare Workers registra <span className="font-bold">IP</span> y{" "}
                  <span className="font-bold">User-Agent</span> de cada request para aplicar rate limiting y mitigar
                  abuso. No combinamos esos logs con tu cuenta para perfilarte.
                </p>
              </div>
            </div>
          </section>
        </div>

        <section className="px-4 space-y-8">
          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <IconDatabase className="size-5 text-primary" /> Dónde viven tus datos
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Usamos <span className="font-bold">Supabase</span> (Postgres + Storage) como base de datos. Las tablas con
              datos personales tienen Row Level Security activado: el cliente público sólo accede a tu propia
              información. Los avatares de usuario se almacenan en el bucket{" "}
              <code className="bg-muted/10 px-1 rounded">user-avatars</code> y los activos de tiendas reclamadas en{" "}
              <code className="bg-muted/10 px-1 rounded">store-assets</code>.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <IconUserCheck className="size-5 text-primary" /> Tiendas reclamadas
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Si reclamás una tienda mediante verificación DNS, asociamos tu cuenta a un{" "}
              <code className="bg-muted/10 px-1 rounded">account</code> y a un perfil editable de la tienda
              (descripción, redes, logo). Otras personas del equipo pueden ser invitadas vía{" "}
              <code className="bg-muted/10 px-1 rounded">account_members</code>. Esa relación es{" "}
              <span className="font-medium text-foreground">pública</span> en la ficha de la tienda.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <IconLock className="size-5 text-primary" /> IA y extracción de specs
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Para extraer especificaciones técnicas usamos modelos LLM (DeepSeek vía API). Sólo enviamos texto de
              producto público (título, descripción de la tienda).{" "}
              <span className="font-medium text-foreground">Nunca</span> enviamos datos de usuarios ni de pedidos a
              estos modelos.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <IconCookie className="size-5 text-primary" /> Cookies y sesión
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Sólo cookies técnicas: la sesión de Supabase Auth, tu preferencia de tema (claro/oscuro) y tu idioma. No
              usamos cookies de publicidad ni trackers de terceros con fines comerciales.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <IconShield className="size-5 text-primary" /> Moderación
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Cuando reportás contenido o un mod toma una decisión, queda registrado en{" "}
              <code className="bg-muted/10 px-1 rounded">reports</code> y{" "}
              <code className="bg-muted/10 px-1 rounded">mod_actions</code> como bitácora interna. Vos podés ver tus
              propios reportes; los mods y admins ven la totalidad para coordinar la moderación.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <IconUserShield className="size-5 text-primary" /> Tus derechos
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Tenés derecho de{" "}
              <span className="font-medium text-foreground">acceso, rectificación, cancelación y oposición</span> sobre
              tus datos personales (Ley 19.628 y, a partir de su entrada en vigencia, Ley 21.719). Para ejercerlos, abrí
              un ticket desde el formulario de soporte de abajo con la categoría{" "}
              <span className="font-medium text-foreground">Privacidad</span> o{" "}
              <span className="font-medium text-foreground">Mis datos</span>. Atendemos cada solicitud dentro de la
              plataforma para que quede registro de la conversación.
            </p>
          </div>

          <SupportContactPanel defaultCategory="privacy" />
        </section>
      </div>
    </div>
  );
}
