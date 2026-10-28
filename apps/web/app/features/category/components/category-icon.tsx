import type { Category } from "@framerate/contracts";
import { cn } from "~/shared/lib/utils";

// Íconos propios de cada categoría: grilla de 24 px y trazo de 1,75 como los de Tabler, para convivir con ellos.
const PATHS: Record<Category, React.ReactNode> = {
  gpu: (
    <>
      <rect x="1.5" y="5" width="21" height="12" rx="2" />
      <circle cx="7.5" cy="11" r="3" />
      <circle cx="16.5" cy="11" r="3" />
      <path d="M4.5 17v2.5h9V17" />
    </>
  ),
  cpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
      <path d="M9.5 3v3M14.5 3v3M9.5 18v3M14.5 18v3M3 9.5h3M3 14.5h3M18 9.5h3M18 14.5h3" />
    </>
  ),
  motherboard: (
    <>
      <rect x="3" y="2" width="18" height="20" rx="2" />
      <rect x="6.5" y="5.5" width="6" height="6.5" rx="1" />
      <path d="M15.5 5.5V12M18 5.5V12M6.5 16.5h11M6.5 19h6" />
    </>
  ),
  ram: (
    <>
      <path d="M3.5 6H20.5A1.5 1.5 0 0 1 22 7.5V9.5a1.25 1.25 0 0 0 0 2.5V14A1.5 1.5 0 0 1 20.5 15.5H3.5A1.5 1.5 0 0 1 2 14V12a1.25 1.25 0 0 0 0-2.5V7.5A1.5 1.5 0 0 1 3.5 6Z" />
      <rect x="4.1" y="8.85" width="2.3" height="3.8" rx=".6" strokeWidth="1.1" />
      <rect x="8.6" y="8.85" width="2.3" height="3.8" rx=".6" strokeWidth="1.1" />
      <rect x="13.1" y="8.85" width="2.3" height="3.8" rx=".6" strokeWidth="1.1" />
      <rect x="17.6" y="8.85" width="2.3" height="3.8" rx=".6" strokeWidth="1.1" />
      <path d="M2.5 15.5v3h6v-3M11.5 15.5v3h10v-3" />
    </>
  ),
  psu: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <circle cx="9.5" cy="12" r="4" />
      <path d="M9.5 8v8M5.5 12h8" />
      <path d="m17.75 9-1.5 3h2.5l-1.5 3" />
    </>
  ),
  ssd: (
    <>
      <path d="M4 8h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1.25a.75.75 0 0 0 0-1.5V10a2 2 0 0 1 2-2Z" />
      <rect x="5.5" y="10.5" width="4" height="3" rx=".5" />
      <rect x="11.5" y="10.5" width="4" height="3" rx=".5" />
      <path d="M18.5 10.5v3" />
    </>
  ),
  hdd: (
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2" />
      <circle cx="12" cy="10" r="4.5" />
      <circle cx="12" cy="10" r=".75" />
      <path d="m16 17.5-3.5-6.5" />
      <circle cx="16" cy="17.5" r="1" />
    </>
  ),
  cpu_cooler: (
    <>
      <path d="M6 5h12M6 8h12M6 11h12M6 14h12" />
      <path d="M9.5 3v15M14.5 3v15" />
      <rect x="5" y="18" width="14" height="3" rx="1" />
    </>
  ),
  case: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M9 5.5h4" />
      <circle cx="15" cy="5.5" r=".75" />
      <circle cx="12" cy="14" r="3.5" />
      <circle cx="12" cy="14" r=".75" />
    </>
  ),
  case_fan: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="12" cy="12" r="1.5" />
      <path d="M12 10.5c0-3 1.5-4.5 3.5-4.5M13.5 12c3 0 4.5 1.5 4.5 3.5M12 13.5c0 3-1.5 4.5-3.5 4.5M10.5 12c-3 0-4.5-1.5-4.5-3.5" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2" y="5.5" width="20" height="13" rx="2" />
      <path d="M5.5 9.5h.01M9 9.5h.01M12.5 9.5h.01M16 9.5h.01M19 9.5h.01M5.5 13h.01M9 13h.01M12.5 13h.01M16 13h.01M19 13h.01M8 16h8" />
    </>
  ),
  mouse: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="5.5" />
      <path d="M12 2.5v6.5M6.5 9h11" />
    </>
  ),
};

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-[18px] shrink-0", className)}
    >
      {PATHS[category]}
    </svg>
  );
}
