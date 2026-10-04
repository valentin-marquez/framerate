// PROTOTIPO (#108): tres variantes radicalmente distintas del navbar, sobre las páginas reales. Sólo en
// desarrollo: la variante vive en la cookie `nav_variant` (el loader raíz la lee, así el SSR no salta).
// Al elegir una, se reescribe en limpio y este directorio se va a una rama de descarte.
import type { CategoryItem } from "@framerate/contracts";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useEffect } from "react";
import { Navbar } from "../navbar";
import * as A from "./variant-a";
import * as B from "./variant-b";
import * as C from "./variant-c";

export const NAV_VARIANTS = ["A", "B", "C", "actual"] as const;
export type NavVariant = (typeof NAV_VARIANTS)[number];
const NAMES: Record<NavVariant, string> = { A: A.name, B: B.name, C: C.name, actual: "El de main" };

export function navVariantFromCookie(cookie: string | null): NavVariant {
  const value = cookie?.match(/(?:^|;\s*)nav_variant=([^;]+)/)?.[1];
  return NAV_VARIANTS.find((v) => v === value) ?? "A";
}

export function NavbarPrototype({
  variant,
  categories,
  blurred,
}: {
  variant: NavVariant;
  categories: CategoryItem[];
  blurred: boolean;
}) {
  if (variant === "A") return <A.VariantA categories={categories} />;
  if (variant === "B") return <B.VariantB categories={categories} />;
  if (variant === "C") return <C.VariantC categories={categories} />;
  return (
    <header className="sticky top-0 z-50 w-full">
      <Navbar categories={categories} blurred={blurred} />
    </header>
  );
}

/** Clases del contenedor de la página según la variante (el riel desplaza el contenido). */
export const prototypeShell: Record<NavVariant, string> = {
  A: "pb-28",
  B: "",
  C: "pb-20 lg:pb-0 lg:pl-64",
  actual: "",
};

export function PrototypeSwitcher({ current }: { current: NavVariant }) {
  const go = (step: number) => {
    const i = NAV_VARIANTS.indexOf(current);
    const next = NAV_VARIANTS[(i + step + NAV_VARIANTS.length) % NAV_VARIANTS.length];
    // biome-ignore lint/suspicious/noDocumentCookie: prototipo, cookie de sólo desarrollo.
    document.cookie = `nav_variant=${next}; path=/; max-age=31536000`;
    window.location.reload();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft" && e.altKey) go(-1);
      if (e.key === "ArrowRight" && e.altKey) go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="fixed top-1/2 right-2 z-[100] flex -translate-y-1/2 flex-col items-center gap-1 rounded-full bg-fuchsia-600 p-1 font-mono text-white text-xs shadow-lg">
      <button
        type="button"
        aria-label="Variante anterior"
        onClick={() => go(-1)}
        className="rounded-full p-1.5 hover:bg-white/20"
      >
        <IconChevronLeft className="size-4" />
      </button>
      <span className="px-1 [writing-mode:vertical-rl]">
        {current} ({NAMES[current]})
      </span>
      <button
        type="button"
        aria-label="Variante siguiente"
        onClick={() => go(1)}
        className="rounded-full p-1.5 hover:bg-white/20"
      >
        <IconChevronRight className="size-4" />
      </button>
    </div>
  );
}
