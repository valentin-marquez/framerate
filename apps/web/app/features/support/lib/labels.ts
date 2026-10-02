import type { SupportCategory, SupportStatus } from "@framerate/contracts";
import {
  IconAlertTriangle,
  IconBug,
  IconBuildingStore,
  IconDatabase,
  IconHelp,
  IconShieldLock,
  IconSparkles,
} from "@tabler/icons-react";

export const CATEGORY_LABELS: Record<SupportCategory, string> = {
  privacy: "Privacidad",
  data_request: "Mis datos",
  abuse_report: "Abuso",
  store_issue: "Tienda",
  bug: "Bug",
  feature: "Sugerencia",
  other: "Otro",
};

export const CATEGORY_ICONS: Record<SupportCategory, typeof IconHelp> = {
  privacy: IconShieldLock,
  data_request: IconDatabase,
  abuse_report: IconAlertTriangle,
  store_issue: IconBuildingStore,
  bug: IconBug,
  feature: IconSparkles,
  other: IconHelp,
};

/** Vista de quien abrió el ticket; el panel de admin cambia `waiting_user`. */
export const STATUS_LABELS: Record<SupportStatus, string> = {
  open: "Abierto",
  in_progress: "En curso",
  waiting_user: "Te respondieron",
  resolved: "Resuelto",
  closed: "Cerrado",
};

export const STATUS_COLORS: Record<SupportStatus, string> = {
  open: "text-warn bg-warn/10",
  in_progress: "text-primary bg-primary/10",
  waiting_user: "text-primary bg-primary/10",
  resolved: "text-success bg-success/10",
  closed: "text-muted-foreground bg-secondary",
};
