import { IconCheck, IconCopy, IconExternalLink, IconWorld } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "~/shared/components/primitives/button";
import { type DnsProviderUi, getDnsProviderUi } from "../lib/dns-providers";

interface DnsInstructionsProps {
  txtName: string;
  txtValue: string;
  /** Dominio que se está verificando — usado para deep-linkear al panel. */
  domain: string;
  /** Id de provider detectado por la API. null = desconocido o falló DoH. */
  dnsProvider?: string | null;
  /** NS records resueltos al crear el claim. Se muestran como evidencia. */
  dnsNameservers?: string[] | null;
}

export function DnsInstructions({ txtName, txtValue, domain, dnsProvider, dnsNameservers }: DnsInstructionsProps) {
  const provider = getDnsProviderUi(dnsProvider);
  const [forceGeneric, setForceGeneric] = useState(false);
  const showProvider = provider && !forceGeneric;

  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      {showProvider ? (
        <ProviderHeader provider={provider} nameservers={dnsNameservers ?? []} domain={domain} />
      ) : (
        <p className="text-muted-foreground text-sm">
          Agregá el siguiente registro <code className="font-mono">TXT</code> en tu DNS para verificar la propiedad del
          dominio.
        </p>
      )}

      {showProvider && <ProviderSteps steps={provider.steps} />}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <CopyField label="Nombre" value={txtName} />
        <CopyField label="Valor" value={txtValue} />
      </div>

      <p className="mt-3 text-muted-foreground text-xs">
        La propagación puede tardar entre 1 minuto y 24 horas según tu proveedor. El reclamo expira en 7 días.
      </p>

      {provider && (
        <div className="mt-2 text-xs">
          {forceGeneric ? (
            <button
              type="button"
              className="cursor-pointer text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => setForceGeneric(false)}
            >
              Volver a ver la guía de {provider.name}
            </button>
          ) : (
            <button
              type="button"
              className="cursor-pointer text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => setForceGeneric(true)}
            >
              ¿No es tu proveedor? Ver instrucciones genéricas
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ProviderHeader({
  provider,
  nameservers,
  domain,
}: {
  provider: DnsProviderUi;
  nameservers: string[];
  domain: string;
}) {
  const dashboardHref =
    typeof provider.dashboardUrl === "function" ? provider.dashboardUrl(domain) : provider.dashboardUrl;
  return (
    <div className="flex items-start gap-3">
      <ProviderLogo provider={provider} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <IconWorld className="size-3.5" />
          Detectamos tu DNS
        </div>
        <div className="mt-0.5 truncate font-semibold text-sm">{provider.name}</div>
        {nameservers.length > 0 && (
          <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={nameservers.join(", ")}>
            {nameservers.slice(0, 2).join(", ")}
            {nameservers.length > 2 && ` +${nameservers.length - 2}`}
          </div>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        nativeButton={false}
        render={
          <a
            href={dashboardHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir el panel DNS de ${provider.name}`}
          >
            Abrir panel
            <IconExternalLink className="size-3.5" />
          </a>
        }
      />
    </div>
  );
}

function ProviderSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="mt-3 space-y-1.5 text-sm">
      {steps.map((step, i) => (
        <li key={step} className="flex gap-2">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-[11px] text-primary">
            {i + 1}
          </span>
          <span className="text-muted-foreground">{step}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Tile del provider: logo real sobre fondo blanco (estilo app-icon) cuando lo
 * tenemos, o un monograma con el color de marca como fallback consistente.
 */
function ProviderLogo({ provider }: { provider: DnsProviderUi }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-white">
      {provider.logo ? (
        <img src={`/dns-providers/${provider.logo}`} alt="" className="size-7 object-contain" loading="lazy" />
      ) : (
        <span className="font-bold text-[11px]" style={{ color: `#${provider.brandColor}` }} aria-hidden>
          {provider.monogram}
        </span>
      )}
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="text-muted-foreground text-xs uppercase tracking-wide">{label}</div>
      <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs">
        <span className="flex-1 truncate" title={value}>
          {value}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <IconCheck className="size-3.5 text-primary" /> : <IconCopy className="size-3.5" />}
        </Button>
      </div>
    </div>
  );
}
