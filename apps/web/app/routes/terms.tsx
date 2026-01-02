import { IconAlertTriangleFilled, IconCode, IconShoppingBag } from "@tabler/icons-react";
import { Separator } from "~/components/primitives/separator";

export function meta() {
  return [
    { title: "Términos - Framerate" },
    { name: "description", content: "Condiciones de uso de la plataforma Framerate.cl" },
  ];
}

export default function Terms() {
  const lastUpdate = "30 de diciembre de 2025";

  return (
    <div className="container mx-auto max-w-4xl px-6 py-12 lg:py-20">
      <header className="mb-12 space-y-4">
        <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary tracking-tight">
          Acuerdo legal
        </div>
        <h1 className="text-4xl font-bold tracking-tight lg:text-5xl">Términos de Servicio</h1>
        <p className="text-muted-foreground">
          Última actualización: <span className="font-medium text-foreground">{lastUpdate}</span>
        </p>
      </header>

      <div className="space-y-12">
        <section className="grid gap-6 md:grid-cols-[200px_1fr]">
          <div className="flex items-start gap-2 pt-1 text-primary">
            <IconShoppingBag className="h-5 w-5" />
            <h2 className="font-semibold uppercase tracking-wider text-xs pt-1">El Servicio</h2>
          </div>
          <div className="space-y-4">
            <p className="text-lg leading-relaxed">
              Framerate.cl es una plataforma de <span className="font-bold">comparación de precios</span>, no una
              tienda. Los datos son recopilados automáticamente mediante técnicas de scraping de diversas tiendas en
              Chile (PC Express, SP Digital, etc.).
            </p>
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-4 text-sm flex gap-3">
              <IconAlertTriangleFilled className="h-5 w-5 text-destructive shrink-0" />
              <p>
                No garantizamos la exactitud de los precios ni el stock. La transacción final ocurre en el sitio del
                vendedor y Framerate no se responsabiliza por problemas en la compra, envío o garantía.
              </p>
            </div>
          </div>
        </section>

        <Separator />
        <section className="grid gap-6 md:grid-cols-[200px_1fr]">
          <div className="flex items-start gap-2 pt-1 text-primary">
            <IconCode className="h-5 w-5" />
            <h2 className="font-semibold uppercase tracking-wider text-xs pt-1">Código Abierto</h2>
          </div>
          <div className="space-y-4">
            <p>
              Este proyecto opera bajo un modelo de <span className="font-bold">licencia dual</span>:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                <span className="text-foreground font-medium underline decoration-primary/30">MIT License:</span> Los
                paquetes compartidos (<code className="bg-muted/10 px-1 rounded">packages/</code>) y la API Gateway (
                <code className="bg-muted/10 px-1 rounded">apps/api</code>) son de libre uso y modificación.
              </li>
              <li>
                <span className="text-foreground font-medium underline decoration-primary/30">Propietario:</span> El
                motor de scraping (<code className="bg-muted/10 px-1 rounded">apps/scraper</code>) y la identidad visual
                del frontend (<code className="bg-muted/10 px-1 rounded">apps/web</code>) están protegidos. Puedes ver
                el código con fines educativos, pero no redistribuirlo comercialmente.
              </li>
            </ul>
          </div>
        </section>

        <Separator />

        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground max-w-md italic flex items-center">
            Al navegar por Framerate, aceptas estos términos. Nos reservamos el derecho de bloquear el acceso a usuarios
            que intenten vulnerar la integridad de nuestros crawlers.
          </p>
        </div>
      </div>
    </div>
  );
}
