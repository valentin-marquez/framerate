import type { SupportCategory, SupportStatus } from "@framerate/contracts";
import {
  IconAlertTriangle,
  IconBug,
  IconBuildingStore,
  IconDatabase,
  IconHelp,
  IconMail,
  IconRobot,
  IconShieldLock,
  IconSparkles,
  IconWorld,
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
  open: "text-warn-ink bg-warn/10 select-none",
  in_progress: "text-primary bg-primary/10 select-none",
  waiting_user: "text-primary bg-primary/10 select-none",
  resolved: "text-success-ink bg-success/10 select-none",
  closed: "text-muted-foreground bg-secondary select-none",
};

const SOURCES: Record<string, { label: string; Icon: typeof IconHelp }> = {
  web: { label: "Web", Icon: IconWorld },
  email: { label: "Correo", Icon: IconMail },
  api: { label: "API", Icon: IconRobot },
  system: { label: "Sistema", Icon: IconRobot },
};

/** `AdminTicket.source` es texto libre: un origen nuevo se ve como "Otro" hasta sumarlo aquí. */
export const ticketSource = (source: string) => SOURCES[source] ?? { label: "Otro", Icon: IconHelp };
