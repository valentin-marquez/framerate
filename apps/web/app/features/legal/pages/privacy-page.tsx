import { IconDatabase, IconGlobe, IconShield } from "@tabler/icons-react";
import { Button } from "~/shared/components/primitives/button";

import type { Route } from "./+types/privacy-page";

export function meta(_: Route.MetaArgs) {
  const title = "Privacidad - Framerate";
  const description =
    "Entiende cómo Framerate.cl protege tus datos, nuestra política de cookies y el uso responsable de la información.";

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
  const lastUpdate = "30 de diciembre de 2025";

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
        <div className="rounded-md border border-border bg-card p-8 transition-all ">
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <IconShield className="size-6 text-primary" />
              <h2 className="text-2xl font-semibold">Nuestro compromiso</h2>
            </div>
            <p className="leading-relaxed">
              En Framerate, creemos en la transparencia. Al ser un proyecto con componentes de código abierto, nuestra
              prioridad es que entiendas qué datos recopilamos y cómo los utilizamos para mejorar tu experiencia
              buscando componentes de PC en Chile.
            </p>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                  <IconDatabase className="size-4" /> Datos de Usuario
                </h3>
                <p className="text-sm">
                  Utilizamos <span className="font-bold">Discord OAuth</span> para la autenticación. Solo guardamos tu
                  ID de usuario, email y nombre para gestionar tus alertas de precio y favoritos.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                  <IconGlobe className="size-4" /> Datos Técnicos
                </h3>
                <p className="text-sm">
                  Recopilamos logs de <span className="font-bold">IP</span> y{" "}
                  <span className="font-bold">User-Agent</span> a través de{" "}
                  <span className="font-bold">Cloudflare Workers</span> para prevenir ataques y aplicar el Rate Limiting
                  de nuestra API.
                </p>
              </div>
            </div>
          </section>
        </div>

        <section className="px-4 space-y-8">
          <div>
            <h2 className="text-xl font-semibold mb-3">Procesamiento de Datos</h2>
            <p className="text-muted-foreground">
              Utilizamos <span className="font-bold">Supabase</span> como base de datos centralizada. Tus datos están
              protegidos por políticas de Row Level Security (RLS), lo que significa que ni siquiera otros usuarios
              pueden ver tus alertas. Para la extracción de especificaciones, utilizamos{" "}
              <span className="font-bold">IA (DeepSeek)</span>, pero nunca enviamos datos personales a estos modelos;
              solo procesamos nombres de productos técnicos.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">Cookies y Sesión</h2>
            <p className="text-muted-foreground">
              No usamos cookies de rastreo publicitario. Las únicas cookies presentes son técnicas para mantener tu
              sesión activa y recordar tus preferencias de tema (Oscuro/Claro).
            </p>
          </div>

          <div className="rounded-md bg-card p-6 border-2 border-dashed border-border text-center">
            <p className="text-sm text-muted-foreground mb-4">¿Tienes dudas sobre cómo manejamos tu información?</p>
            <Button className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <a href="mailto:soporte@framerate.com">Contactar a Soporte</a>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
