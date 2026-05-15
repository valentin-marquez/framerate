import { IconFlag } from "@tabler/icons-react";
import { useState } from "react";
import { Button, type ButtonProps } from "~/shared/components/primitives/button";
import type { ReportTargetType } from "../services/reports.client";
import { ReportModal } from "./report-modal";

export interface ReportButtonProps {
  targetType: ReportTargetType;
  targetId: string;
  /** Token JWT del usuario actual. Si es null/undefined, el modal alerta y pide login. */
  token?: string | null;
  /** Texto descriptivo opcional para mostrar en el header del modal. */
  contextLabel?: string;
  /** Variante visual del boton. Por defecto ghost (poco invasivo). */
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  /** Si true, oculta el texto y muestra solo el icono. */
  iconOnly?: boolean;
  label?: string;
}

/**
 * Boton + modal de reporte. Pensado para usarse desde cualquier card
 * (product, comment, store-review, store).
 *
 * @example
 * ```tsx
 * <ReportButton targetType="product" targetId={product.id} token={session?.access_token} />
 * ```
 */
export function ReportButton({
  targetType,
  targetId,
  token,
  contextLabel,
  variant = "ghost",
  size = "sm",
  className,
  iconOnly = false,
  label = "Reportar",
}: ReportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={iconOnly ? "icon-sm" : size}
        className={className}
        onClick={() => setOpen(true)}
        aria-label={label}
      >
        <IconFlag className="size-4" aria-hidden="true" />
        {iconOnly ? null : <span>{label}</span>}
      </Button>
      <ReportModal
        open={open}
        onOpenChange={setOpen}
        targetType={targetType}
        targetId={targetId}
        token={token}
        contextLabel={contextLabel}
      />
    </>
  );
}
