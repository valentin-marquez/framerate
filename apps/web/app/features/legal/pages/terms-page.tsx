import {
  IconAlertTriangleFilled,
  IconBuildingStore,
  IconCode,
  IconCopyright,
  IconDatabase,
  IconShoppingBag,
  IconUserCircle,
} from "@tabler/icons-react";
import { Separator } from "~/shared/components/primitives/separator";

export function meta() {
  const title = "Términos de Servicio - Framerate";
  const description =
    "Condiciones de uso, licencia PolyForm Noncommercial, marca registrada y reglas para cuentas y tiendas reclamadas en Framerate.cl.";

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

export default function Terms() {
  const lastUpdate = "20 de mayo de 2026";

  return (
    <div className="container mx-auto max-w-4xl px-6 py-12 lg:py-20">
      <header className="mb-12 space-y-4">
        <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary tracking-tight">
          Acuerdo legal
        </div>
        <h1 className="text-4xl font-semibold tracking-tight lg:text-5xl">Términos de Servicio</h1>
        <p className="text-muted-foreground">
          Última actualización: <span className="font-medium text-foreground">{lastUpdate}</span>
        </p>
      </header>

      <div className="space-y-12">
        <section className="grid gap-6 md:grid-cols-[200px_1fr]">
          <div className="flex items-start gap-2 pt-1 text-primary">
            <IconShoppingBag className="size-5" />
            <h2 className="font-semibold uppercase tracking-wider text-xs pt-1">El Servicio</h2>
          </div>
          <div className="space-y-4">
            <p className="text-lg leading-relaxed">
              Framerate.cl es una plataforma de <span className="font-bold">comparación de precios</span> de componentes
              de PC en Chile. No vendemos productos: agregamos información publicada por tiendas como PC Express, SP
              Digital, Central Gamer, Centrale, MyShop, NotebooksYa y TecTec.
            </p>
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-4 text-sm flex gap-3">
              <IconAlertTriangleFilled className="size-5 text-destructive shrink-0" />
              <p>
                Los precios y el stock pueden estar desactualizados o ser incorrectos. La compra ocurre íntegramente en
                el sitio de la tienda y Framerate no es parte de esa transacción: no respondemos por pagos, envíos,
                garantías ni postventa.
              </p>
            </div>
          </div>
        </section>

        <Separator />

        <section className="grid gap-6 md:grid-cols-[200px_1fr]">
          <div className="flex items-start gap-2 pt-1 text-primary">
            <IconUserCircle className="size-5" />
            <h2 className="font-semibold uppercase tracking-wider text-xs pt-1">Cuentas</h2>
          </div>
          <div className="space-y-4">
            <p>
              Podés navegar Framerate sin cuenta. Si te registrás (vía Discord, Google, Apple o Facebook), pasás a poder
              guardar favoritos, armar cotizaciones, dejar reseñas a tiendas, comentar productos y reclamar la ficha de
              una tienda que administres.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                Sos responsable de mantener la seguridad de la cuenta del proveedor con que iniciás sesión. No usamos
                contraseñas propias.
              </li>
              <li>
                Tu nombre de usuario y avatar son <span className="font-medium text-foreground">públicos</span> en las
                rutas de perfil (<code className="bg-muted/10 px-1 rounded">/u/:username</code>) y en lo que publiques
                (reseñas, comentarios, cotizaciones compartidas).
              </li>
              <li>
                Podemos suspender o cerrar cuentas que abusen del servicio (spam, evasión de rate limits, intentos de
                vulnerar los crawlers, suplantación, contenido que viole la ley chilena).
              </li>
            </ul>
          </div>
        </section>

        <Separator />

        <section className="grid gap-6 md:grid-cols-[200px_1fr]">
          <div className="flex items-start gap-2 pt-1 text-primary">
            <IconBuildingStore className="size-5" />
            <h2 className="font-semibold uppercase tracking-wider text-xs pt-1">Tiendas reclamadas</h2>
          </div>
          <div className="space-y-4">
            <p>
              Si representás una tienda listada, podés <span className="font-bold">reclamar</span> su perfil verificando
              el dominio mediante un registro DNS TXT. Una vez verificada, vos y tu equipo pueden editar el perfil
              público (logo, descripción, redes), pero no los datos de catálogo, precios ni reseñas de usuarios.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                Reclamar una tienda implica que tenés autorización para representarla. Reclamos fraudulentos pueden ser
                revocados sin aviso y el responsable suspendido.
              </li>
              <li>
                Si el TXT desaparece, el perfil entra en <span className="font-medium text-foreground">freeze</span>: el
                contenido queda visible pero las ediciones se bloquean hasta re-verificar.
              </li>
              <li>
                Las reseñas que dejan los usuarios sobre tu tienda no se editan ni se borran a pedido del dueño. Si una
                reseña viola las normas, podés reportarla desde la propia ficha.
              </li>
            </ul>
          </div>
        </section>

        <Separator />

        <section className="grid gap-6 md:grid-cols-[200px_1fr]">
          <div className="flex items-start gap-2 pt-1 text-primary">
            <IconCode className="size-5" />
            <h2 className="font-semibold uppercase tracking-wider text-xs pt-1">Código abierto</h2>
          </div>
          <div className="space-y-4">
            <p>
              Todo el código fuente del repositorio (<code className="bg-muted/10 px-1 rounded">apps/</code> y{" "}
              <code className="bg-muted/10 px-1 rounded">packages/</code>) se publica bajo la{" "}
              <a
                href="https://polyformproject.org/licenses/noncommercial/1.0.0"
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-foreground underline decoration-primary/30 hover:decoration-primary"
              >
                PolyForm Noncommercial License 1.0.0
              </a>
              . En palabras simples:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                <span className="text-foreground font-medium">Sí podés:</span> leer, hacer fork, estudiar, modificar y
                self-hostear para estudio personal, hobby, investigación u organizaciones sin fines de lucro.
              </li>
              <li>
                <span className="text-foreground font-medium">No podés:</span> usarlo dentro de un producto o servicio
                comercial, cobrar acceso, monetizar el catálogo curado ni operar una alternativa comercial competitiva
                basada en este código.
              </li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Para uso comercial, escribí a{" "}
              <a href="mailto:valentin13.mail@gmail.com" className="font-medium text-foreground underline">
                valentin13.mail@gmail.com
              </a>{" "}
              y conversamos una licencia.
            </p>
          </div>
        </section>

        <Separator />

        <section className="grid gap-6 md:grid-cols-[200px_1fr]">
          <div className="flex items-start gap-2 pt-1 text-primary">
            <IconCopyright className="size-5" />
            <h2 className="font-semibold uppercase tracking-wider text-xs pt-1">Marca y BD curada</h2>
          </div>
          <div className="space-y-4">
            <p>
              La licencia del código <span className="font-bold">no</span> incluye el nombre Framerate, el dominio
              framerate.cl, el logo, la paleta de colores, la tipografía ni la identidad visual del frontend (incluyendo
              el sistema de diseño inspirado en macOS). Son propiedad del titular del copyright.
            </p>
            <p>
              La <span className="font-bold">base de datos curada</span> (productos canónicos, especificaciones
              normalizadas, imágenes curadas, relaciones con tiendas) tampoco se licencia: es resultado de operar la
              infraestructura de Framerate y se reserva el derecho de uso comercial.
            </p>
            <p className="text-sm text-muted-foreground">
              Si self-hosteás el código bajo la licencia no comercial, tenés que reemplazar el nombre, el logo y usar un
              dominio que no se confunda con framerate.cl.
            </p>
          </div>
        </section>

        <Separator />

        <section className="grid gap-6 md:grid-cols-[200px_1fr]">
          <div className="flex items-start gap-2 pt-1 text-primary">
            <IconDatabase className="size-5" />
            <h2 className="font-semibold uppercase tracking-wider text-xs pt-1">Contenido que publicás</h2>
          </div>
          <div className="space-y-4">
            <p>
              Reseñas, comentarios, cotizaciones públicas y demás contenido que publiques siguen siendo tuyos. Al
              publicarlos en Framerate nos concedés una licencia mundial, no exclusiva y libre de regalías para
              mostrarlos en la plataforma mientras tu cuenta esté activa.
            </p>
            <p className="text-sm text-muted-foreground">
              Si borrás tu cuenta, despublicamos tu contenido público asociado. Conservamos copias mínimas si una ley
              chilena nos obliga o si son evidencia de una infracción a estos términos.
            </p>
          </div>
        </section>

        <Separator />

        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground max-w-xl italic">
            Al navegar Framerate aceptás estos términos. Pueden cambiar; cuando lo hagamos, actualizamos la fecha de
            arriba y, para cambios materiales, lo avisamos en el sitio.
          </p>
        </div>
      </div>
    </div>
  );
}
