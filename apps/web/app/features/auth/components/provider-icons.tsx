import type { ComponentType } from "react";
import { Apple } from "~/shared/components/icons/apple";
import { Discord } from "~/shared/components/icons/discord";
import { Facebook } from "~/shared/components/icons/facebook";
import { Google } from "~/shared/components/icons/google";

const ICONS: Record<string, { Icon: ComponentType<{ className?: string }>; iconClass: string }> = {
  discord: { Icon: Discord, iconClass: "size-4" },
  google: { Icon: Google, iconClass: "size-4" },
  apple: { Icon: Apple, iconClass: "size-4 invert dark:invert-0" },
  facebook: { Icon: Facebook, iconClass: "size-4" },
};

/** Ícono de un proveedor; los que no tienen ícono propio se muestran sólo con texto. */
export function ProviderIcon({ id }: { id: string }) {
  const entry = ICONS[id];
  return entry ? <entry.Icon className={entry.iconClass} /> : null;
}
