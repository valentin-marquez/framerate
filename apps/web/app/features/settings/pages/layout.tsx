import { IconSettings, IconUser } from "@tabler/icons-react";
import { NavLink, Outlet, useLocation } from "react-router";
import { requireAuth } from "~/features/auth/services/auth.server";
import { Separator } from "~/shared/components/primitives/separator";
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

export default function SettingsLayout() {
  const location = useLocation();
  const isDefaultRoute = location.pathname === "/settings";
  const { t } = useTranslation();

  const sidebarItems = [
    {
      title: t("account"),
      href: "/settings/account",
      icon: IconUser,
    },
    {
      title: t("preferences"),
      href: "/settings/preferences",
      icon: IconSettings,
    },
  ];

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-5xl">
      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        <aside className="w-full md:w-64 shrink-0 space-y-6 md:space-y-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-4 md:mb-6">{t("settings")}</h1>
            <nav className="flex flex-row md:flex-col gap-2 md:gap-0 md:space-y-1 overflow-x-auto pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
              {sidebarItems.map((item, index) => {
                const isDefaultActive = isDefaultRoute && index === 0;

                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                        isActive || isDefaultActive
                          ? "text-primary bg-secondary/50 md:bg-transparent md:border-r-2 md:border-primary md:rounded-none"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                      )
                    }
                    prefetch="render"
                  >
                    <item.icon className="size-4" />
                    {item.title}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </aside>

        <Separator orientation="vertical" className="hidden md:block" />

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
