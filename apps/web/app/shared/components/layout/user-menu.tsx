import { IconLogin, IconLogout, IconPlus, IconSelector, IconSettings, IconUserCircle } from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router";
import { LoginDialog } from "~/features/auth/components/login-dialog";
import { useProfile, useUser } from "~/features/auth/hooks/useAuth";
import { CreateQuoteDialog } from "~/features/quote/components/create-quote-dialog";
import { MyStoresMenu } from "~/features/stores/components/my-stores-menu";
import { AdminMenu } from "~/shared/components/layout/admin-menu";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";
import { AsyncImage } from "../primitives/async-image";
import { buttonVariants } from "../primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu";

/** Avatar con el menú de cuenta, o el botón de ingreso sin sesión. */
export function UserMenu({
  loginClassName,
  railLabel,
  align = "end",
  side = "bottom",
}: {
  align?: "start" | "end";
  side?: "top" | "bottom" | "right";
  /** Clases extra del botón de ingreso (sin sesión). */
  loginClassName?: string;
  /**
   * En el riel: con sesión, una tarjeta de perfil (foto, nombre y usuario) cuyo texto se desvanece cuando el riel está
   * angosto (.rail-label) y la foto queda en la columna de íconos; sin sesión, ícono más etiqueta.
   */
  railLabel?: boolean;
}) {
  const user = useUser();
  const profile = useProfile();
  const { t } = useTranslation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const profileHref = profile?.username ? `/u/${profile.username}` : "/perfil";

  return user ? (
    // `key` distinta por rama: ambas ramas del ternario renderizan
    // <DropdownMenu> en la misma posición JSX. Sin keys, React reusa
    // la misma instancia de MenuRoot al cambiar `user` y el prop
    // `open` salta controlled↔uncontrolled (warning de Base UI).
    <>
      <DropdownMenu key="user-menu" open={userMenuOpen} onOpenChange={setUserMenuOpen}>
        <DropdownMenuTrigger
          aria-label={t("user")}
          className={
            railLabel
              ? // La foto (32 px) queda centrada en la columna de íconos del riel: 12 px del riel más 4 de relleno.
                "flex h-12 w-full cursor-pointer items-center gap-2.5 overflow-hidden rounded-xl px-1 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 data-[popup-open]:bg-secondary"
              : cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "rounded-full p-0",
                  // Suaviza el foco: el ring de 3px + border-ring de buttonVariants
                  // se ve muy fuerte (blanco puro en dark) alrededor del avatar.
                  "focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-transparent",
                )
          }
        >
          {profile?.avatar_url ? (
            <AsyncImage
              src={profile?.avatar_url}
              alt={profile?.full_name || user.email || "avatar"}
              className={cn("shrink-0 rounded-full object-cover", railLabel ? "size-8" : "size-6")}
            />
          ) : (
            <IconUserCircle
              className={cn("shrink-0 text-muted-foreground", railLabel ? "size-8" : "size-6")}
              stroke={1.5}
            />
          )}
          {railLabel && (
            <>
              <span className="rail-label flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-foreground text-sm">
                  {profile?.full_name || profile?.username || t("user")}
                </span>
                <span className="truncate text-muted-foreground text-xs">
                  {profile?.username ? `@${profile.username}` : user.email}
                </span>
              </span>
              <IconSelector className="rail-label size-4 shrink-0 text-muted-foreground" />
            </>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent align={align} side={side} className="w-69 text-base rounded-xl">
          <DropdownMenuItem
            className="flex items-center gap-3 p-3"
            render={<Link to={profileHref} prefetch="intent" />}
          >
            {profile?.avatar_url ? (
              <AsyncImage
                src={profile?.avatar_url}
                alt={profile?.full_name || user.email || "avatar"}
                className="size-12 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="size-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                <IconUserCircle className="size-7 text-muted-foreground" />
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <p className="text-base font-medium text-foreground truncate">
                {profile?.full_name || profile?.username || t("user")}
              </p>
              {user.email && <p className="text-sm text-muted-foreground truncate">{user.email}</p>}
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setQuoteOpen(true)}>
              <IconPlus className="size-5" />
              <span>{t("create_quote")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to={profileHref} prefetch="intent" />}>
              <IconUserCircle className="size-5" />
              <span>{t("profile")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/ajustes" prefetch="intent" />}>
              <IconSettings className="size-5" />
              <span>{t("settings")}</span>
            </DropdownMenuItem>

            {/* Sólo se monta cuando el dropdown está abierto: evita un */}
            {/* fetch innecesario al cargar la navbar para users sin tiendas. */}
            {userMenuOpen && <MyStoresMenu enabled={userMenuOpen} />}
            {userMenuOpen && <AdminMenu enabled={userMenuOpen} />}

            <DropdownMenuSeparator />
            <form method="post" action="/action/auth">
              <input type="hidden" name="action" value="logout" />
              <DropdownMenuItem nativeButton className="w-full cursor-pointer" render={<button type="submit" />}>
                <IconLogout className="size-5" />
                <span>{t("logout")}</span>
              </DropdownMenuItem>
            </form>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateQuoteDialog open={quoteOpen} onOpenChange={setQuoteOpen} />
    </>
  ) : (
    <LoginDialog
      trigger={
        <button
          type="button"
          aria-label={railLabel ? t("login") : undefined}
          className={cn(
            "inline-flex h-8 cursor-pointer items-center justify-center rounded-full bg-secondary px-3.5 font-medium text-foreground text-sm transition-colors hover:bg-primary hover:text-primary-foreground",
            loginClassName,
          )}
        >
          {railLabel ? (
            <>
              <IconLogin className="size-[18px] shrink-0" stroke={1.75} />
              <span className="rail-label">{t("login")}</span>
            </>
          ) : (
            t("login")
          )}
        </button>
      }
    />
  );
}
