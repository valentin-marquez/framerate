import { NavLink, Outlet, useLocation } from "react-router";
import { requireAuth } from "~/features/auth/services/auth.server";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";
import type { Route } from "./+types/layout";

export function meta() {
  return [{ title: "Ajustes - Framerate" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return null;
}

/** Ajustes: título, pestañas subrayadas y el contenido en una sola columna. */
export default function SettingsLayout() {
  const { pathname } = useLocation();
  const { t } = useTranslation();

  const tabs = [
    { title: t("account"), href: "/ajustes/cuenta" },
    { title: t("preferences"), href: "/ajustes/preferencias" },
    { title: "Mis tickets", href: "/ajustes/tickets" },
  ];

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <header className="space-y-5 pt-2">
        <h1 className="font-semibold text-3xl text-foreground">{t("settings")}</h1>
        <nav
          aria-label="Secciones de ajustes"
          className="-mx-4 flex gap-6 overflow-x-auto border-border border-b px-4 sm:mx-0 sm:px-0"
        >
          {tabs.map((tab, i) => (
            <NavLink
              key={tab.href}
              to={tab.href}
              prefetch="intent"
              className={({ isActive }) =>
                cn(
                  "-mb-px whitespace-nowrap border-b-2 pb-2.5 font-medium text-sm transition-colors",
                  isActive || (i === 0 && pathname === "/ajustes")
                    ? "border-foreground text-foreground"
                    : "border-transparent text-foreground/40 hover:text-foreground",
                )
              }
            >
              {tab.title}
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="pt-8">
        <Outlet />
      </div>
    </div>
  );
}
