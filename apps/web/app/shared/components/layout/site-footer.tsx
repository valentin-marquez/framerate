import { IconBrandGithub } from "@tabler/icons-react";
import { Link } from "react-router";
import { Logo } from "./logo";

const LINKS = [
  { to: "/explorar", label: "Explorar" },
  { to: "/reclamar", label: "Para tiendas" },
  { to: "/terms", label: "Términos" },
  { to: "/privacy", label: "Privacidad" },
];

const link = "px-2 py-2 text-foreground/40 text-sm transition-colors hover:text-foreground";

/** Pie mínimo: logo y enlaces a la izquierda, redes a la derecha, sobre un separador fino. */
export function SiteFooter() {
  return (
    <footer className="container mx-auto max-w-5xl px-4">
      <div className="flex flex-col items-center justify-between gap-3 border-border border-t py-6 sm:flex-row">
        <nav aria-label="Pie de página" className="flex flex-wrap items-center justify-center">
          <Link
            to="/"
            aria-label="Framerate"
            className="mr-2 text-foreground/40 transition-colors hover:text-foreground"
          >
            <Logo className="size-5" />
          </Link>
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} prefetch="intent" className={link}>
              {l.label}
            </Link>
          ))}
        </nav>
        <a
          href="https://github.com/valentin-marquez/framerate/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Código en GitHub"
          className="p-2 text-foreground/40 transition-colors hover:text-foreground"
        >
          <IconBrandGithub className="size-[18px]" stroke={1.75} />
        </a>
      </div>
    </footer>
  );
}
