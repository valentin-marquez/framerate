import { MCP_TOOLS, MCP_URL } from "@framerate/contracts";
import { IconCheck, IconCopy, IconGauge, IconMessageQuestion, IconPlug, IconTool } from "@tabler/icons-react";
import { type ReactNode, useState } from "react";
import { z } from "zod";
import { CopyField } from "~/shared/components/copy-field";
import { Button } from "~/shared/components/primitives/button";
import { Separator } from "~/shared/components/primitives/separator";
import { cn } from "~/shared/lib/utils";

export function meta() {
  const title = "Servidor MCP para desarrolladores - Framerate";
  const description =
    "Conecta Claude, ChatGPT, Cursor o VS Code al catálogo de Framerate: busca componentes de PC, compara precios entre tiendas chilenas y revisa su historial. Público, de sólo lectura y sin token.";

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

type Client = { id: string; label: string; steps: ReactNode[]; code?: { file?: string; text: string } };

const CLIENTS: Client[] = [
  {
    id: "claude",
    label: "Claude",
    steps: [
      "En claude.ai o en la app de escritorio, abre Configuración y luego Conectores.",
      "Elige Agregar conector personalizado.",
      <>
        Ponle de nombre Framerate y pega la URL <code className="font-mono text-sm">{MCP_URL}</code>.
      </>,
      "Actívalo en el chat desde el menú de herramientas.",
    ],
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    steps: [
      "En Configuración, abre Aplicaciones y conectores y activa el modo desarrollador en las opciones avanzadas.",
      <>
        Crea un conector con la URL <code className="font-mono text-sm">{MCP_URL}</code> y sin autenticación.
      </>,
    ],
  },
  {
    id: "claude-code",
    label: "Claude Code",
    steps: ["En la terminal:"],
    code: { text: `claude mcp add --transport http framerate ${MCP_URL}` },
  },
  {
    id: "cursor",
    label: "Cursor",
    steps: ["Agrégalo a la configuración de MCP de Cursor:"],
    code: {
      file: "~/.cursor/mcp.json",
      text: JSON.stringify({ mcpServers: { framerate: { url: MCP_URL } } }, null, 2),
    },
  },
  {
    id: "vscode",
    label: "VS Code",
    steps: ["Agrégalo al proyecto, o al perfil con MCP: Add Server:"],
    code: {
      file: ".vscode/mcp.json",
      text: JSON.stringify({ servers: { framerate: { type: "http", url: MCP_URL } } }, null, 2),
    },
  },
];

const QUESTIONS = [
  "¿Cuál es la RTX 4060 más barata con stock?",
  "Compara el Ryzen 7 7800X3D entre tiendas, en efectivo y con tarjeta.",
  "¿Bajó el precio de la RTX 5070 en el último mes?",
  "Busca una placa B650M bajo $150.000 en PC Express.",
];

type Param = { name: string; type: string; required: boolean; default?: unknown; description?: string };

const TYPES: Record<string, string> = { string: "texto", integer: "entero", number: "número" };

/** Los parámetros salen del mismo esquema que registra el servidor. */
const TOOLS = Object.entries(MCP_TOOLS).map(([name, tool]) => {
  const schema = z.toJSONSchema(z.object(tool.inputSchema), { io: "input" });
  const params: Param[] = Object.entries(schema.properties ?? {}).map(([param, raw]) => {
    const p = raw as { type?: string; enum?: unknown[]; default?: unknown; description?: string };
    return {
      name: param,
      type: p.enum ? "opción" : (TYPES[p.type ?? ""] ?? p.type ?? ""),
      required: schema.required?.includes(param) ?? false,
      default: p.default,
      description: p.description,
    };
  });
  return { name, description: tool.description, params };
});

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 md:grid-cols-[200px_1fr]">
      <div className="flex items-start gap-2 pt-1 text-primary">
        {icon}
        <h2 className="pt-1 font-semibold text-xs uppercase tracking-wider">{title}</h2>
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

function CodeBlock({ file, text }: { file?: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between gap-2 border-border border-b px-3 py-1.5 text-muted-foreground text-xs">
        <span className="font-mono">{file ?? "terminal"}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={copied ? "Copiado" : "Copiar"}
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <IconCheck className="size-3.5 text-primary" /> : <IconCopy className="size-3.5" />}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">{text}</pre>
    </div>
  );
}

function Connect() {
  const [active, setActive] = useState(CLIENTS[0]?.id);
  const client = CLIENTS.find((c) => c.id === active) ?? CLIENTS[0];
  if (!client) return null;
  return (
    <>
      <div role="tablist" className="-mx-1 flex overflow-x-auto text-muted-foreground text-sm">
        {CLIENTS.map((c) => (
          <button
            type="button"
            role="tab"
            key={c.id}
            id={`tab-${c.id}`}
            aria-selected={c.id === client.id}
            aria-controls="client-panel"
            onClick={() => setActive(c.id)}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 transition-colors",
              c.id === client.id ? "bg-secondary/70 font-medium text-foreground" : "hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div id="client-panel" role="tabpanel" aria-labelledby={`tab-${client.id}`} className="space-y-3">
        <ol className="list-decimal space-y-2 pl-5">
          {client.steps.map((step, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: pasos fijos de un cliente
            <li key={i}>{step}</li>
          ))}
        </ol>
        {client.code && <CodeBlock {...client.code} />}
      </div>
    </>
  );
}

export default function Developers() {
  return (
    <div className="container mx-auto max-w-4xl px-6 py-12 lg:py-20">
      <header className="mb-12 space-y-4">
        <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 font-medium text-primary text-xs tracking-tight">
          Desarrolladores
        </div>
        <h1 className="font-semibold text-4xl tracking-tight lg:text-5xl">Servidor MCP</h1>
        <p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
          Conecta tu asistente de IA al catálogo de Framerate para buscar componentes, comparar precios entre tiendas
          chilenas y ver su historial. Es público y de sólo lectura: no necesitas cuenta ni token.
        </p>
        <div className="max-w-md">
          <CopyField label="URL del servidor" value={MCP_URL} />
        </div>
      </header>

      <div className="space-y-12">
        <Section icon={<IconPlug className="size-5" />} title="Conectarlo">
          <Connect />
          <p className="text-muted-foreground text-sm">
            Cualquier otro cliente que soporte HTTP streamable sirve con la misma URL.
          </p>
        </Section>

        <Separator />

        <Section icon={<IconTool className="size-5" />} title="Herramientas">
          <div className="divide-y divide-border">
            {TOOLS.map((tool) => (
              <div key={tool.name} className="space-y-3 py-5 first:pt-0 last:pb-0">
                <h3 className="font-medium font-mono">{tool.name}</h3>
                <p className="text-muted-foreground text-sm">{tool.description}</p>
                {tool.params.length > 0 && (
                  <dl className="divide-y divide-border rounded-lg border border-border">
                    {tool.params.map((p) => (
                      <div key={p.name} className="space-y-1 px-3 py-2">
                        <dt className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-mono">{p.name}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">{p.type}</span>
                          {p.required ? (
                            <span className="text-primary text-xs">obligatorio</span>
                          ) : p.default !== undefined ? (
                            <span className="text-muted-foreground text-xs">por defecto {String(p.default)}</span>
                          ) : null}
                        </dt>
                        {p.description && <dd className="text-muted-foreground text-sm">{p.description}</dd>}
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            ))}
          </div>
        </Section>

        <Separator />

        <Section icon={<IconMessageQuestion className="size-5" />} title="Qué preguntarle">
          <ul className="space-y-2">
            {QUESTIONS.map((q) => (
              <li key={q} className="rounded-lg border border-border px-3 py-2 text-sm">
                {q}
              </li>
            ))}
          </ul>
        </Section>

        <Separator />

        <Section icon={<IconGauge className="size-5" />} title="Límites">
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">600 peticiones por minuto</span> por IP.
            </li>
            <li>Hasta 25 resultados por página y 20 páginas por búsqueda.</li>
            <li>Precios en pesos chilenos, en efectivo y con tarjeta. Las tiendas se revisan cada unas 6 horas.</li>
            <li>
              Si algo falla o quieres un límite mayor, escríbenos a{" "}
              <a href="mailto:soporte@framerate.cl" className="font-medium text-foreground underline">
                soporte@framerate.cl
              </a>
              .
            </li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
