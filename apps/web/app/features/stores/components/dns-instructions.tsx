import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "~/shared/components/primitives/button";

interface DnsInstructionsProps {
  txtName: string;
  txtValue: string;
}

export function DnsInstructions({ txtName, txtValue }: DnsInstructionsProps) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <p className="text-muted-foreground text-sm">
        Agregá el siguiente registro <code className="font-mono">TXT</code> en tu DNS para verificar la propiedad del
        dominio.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <CopyField label="Nombre" value={txtName} />
        <CopyField label="Valor" value={txtValue} />
      </div>
      <p className="mt-3 text-muted-foreground text-xs">
        La propagación puede tardar entre 1 minuto y 24 horas según tu proveedor. El reclamo expira en 7 días.
      </p>
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
