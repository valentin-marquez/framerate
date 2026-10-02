import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "~/shared/components/primitives/button";

/** Valor de una línea con su etiqueta y un botón para copiarlo. */
export function CopyField({ label, value }: { label: string; value: string }) {
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
          aria-label={copied ? "Copiado" : `Copiar ${label.toLowerCase()}`}
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
