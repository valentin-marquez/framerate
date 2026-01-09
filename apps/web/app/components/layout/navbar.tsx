import { IconCompass, IconCpu, IconLogin, IconLogout, IconSettings, IconUserCircle } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Apple } from "@/components/icons/apple";
import { Discord } from "@/components/icons/discord";
import { Facebook } from "@/components/icons/facebook";
import { Google } from "@/components/icons/google";
import { Logo } from "@/components/layout/logo";
import { useTranslation } from "~/hooks/use-translation";
import { useProfile, useUser } from "~/hooks/useAuth";
import { cn } from "~/lib/utils";
import type { Category } from "~/services/categories";
import { getCategoryConfig } from "~/utils/categories";
import { AsyncImage } from "../primitives/async-image";
import { Button, buttonVariants } from "../primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";
import { CreateQuoteDialog } from "../quotes/create-quote-dialog";
import { SearchTrigger } from "../search/search-dialog";

interface NavbarProps {
  categories: Category[];
  blurred?: boolean;
}

type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

const GRADIENTS: Record<TimeOfDay, string> = {
  morning: "linear-gradient(rgba(255, 183, 77, 0.2) 0%, rgba(255, 213, 79, 0.1) 50%, rgba(249, 230, 203, 0) 100%)",
  afternoon: "linear-gradient(rgba(126, 60, 142, 0.2) 0%, rgba(227, 154, 101, 0.1) 50%, rgba(249, 230, 203, 0) 100%)",
  evening: "linear-gradient(rgba(255, 87, 34, 0.2) 0%, rgba(233, 30, 99, 0.1) 50%, rgba(249, 230, 203, 0) 100%)",
  night: "linear-gradient(rgba(63, 81, 181, 0.2) 0%, rgba(48, 63, 159, 0.1) 50%, rgba(26, 35, 126, 0) 100%)",
};

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 21) return "evening";
  return "night";
}

export function Navbar({ categories, blurred }: NavbarProps) {
  const user = useUser();
  const profile = useProfile();
  const { t } = useTranslation();

  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("afternoon");
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [showGreeting, setShowGreeting] = useState(false);
  const [greetingMessage, setGreetingMessage] = useState("");

  const [visibleGradient, setVisibleGradient] = useState<string>("transparent");
  const [gradientVisible, setGradientVisible] = useState<boolean>(false);
  const GRADIENT_FADE_MS = 700;

  void categories;

  useEffect(() => {
    const currentTimeOfDay = getTimeOfDay();
    setTimeOfDay(currentTimeOfDay);

    // Initial greeting
    const randomIndex = Math.floor(Math.random() * 5) + 1;
    setGreetingMessage(t(`greeting_${currentTimeOfDay}_${randomIndex}`));

    const interval = setInterval(() => {
      const newTimeOfDay = getTimeOfDay();
      setTimeOfDay(newTimeOfDay);
      const newRandomIndex = Math.floor(Math.random() * 5) + 1;
      setGreetingMessage(t(`greeting_${newTimeOfDay}_${newRandomIndex}`));
    }, 60000);

    return () => clearInterval(interval);
  }, [t]);

  useEffect(() => {
    const target = GRADIENTS[timeOfDay] ?? "transparent";
    let fadeOutTimer: number | undefined;
    let fadeInTimer: number | undefined;

    if (visibleGradient === "transparent" && !gradientVisible) {
      setVisibleGradient(target);
      fadeInTimer = window.setTimeout(() => setGradientVisible(true), 50);
      return () => {
        if (fadeInTimer) clearTimeout(fadeInTimer);
      };
    }

    if (visibleGradient === target) {
      setGradientVisible(true);
      return;
    }

    setGradientVisible(false);
    fadeOutTimer = window.setTimeout(() => {
      setVisibleGradient(target);
      fadeInTimer = window.setTimeout(() => setGradientVisible(true), 50);
    }, GRADIENT_FADE_MS);

    return () => {
      if (fadeOutTimer) clearTimeout(fadeOutTimer);
      if (fadeInTimer) clearTimeout(fadeInTimer);
    };
  }, [timeOfDay, gradientVisible, visibleGradient]);

  useEffect(() => {
    setCurrentPath(window.location.pathname + window.location.search);
  }, []);

  // mostrar mensaje despues de que la pagina haya cargado completamente
  useEffect(() => {
    const SHOW_DELAY = 500;
    const VISIBLE_MS = 12000;

    const showSequence = () => {
      const showTimer = setTimeout(() => setShowGreeting(true), SHOW_DELAY);
      const hideTimer = setTimeout(() => setShowGreeting(false), SHOW_DELAY + VISIBLE_MS);

      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    };

    if (document.readyState === "complete") {
      const cleanup = showSequence();
      return cleanup;
    } else {
      let cleanupFn: (() => void) | undefined;
      const handleLoad = () => {
        cleanupFn = showSequence();
      };

      window.addEventListener("load", handleLoad);
      return () => {
        window.removeEventListener("load", handleLoad);
        if (cleanupFn) cleanupFn();
      };
    }
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "fixed left-0 right-0 top-0 pointer-events-none -z-10 h-50 transition-opacity duration-700 ease-in-out",
          gradientVisible ? "opacity-100" : "opacity-0",
        )}
        style={{
          background: visibleGradient,
        }}
      />

      <nav
        className={cn(
          "sticky top-0 z-40 h-13 w-full transition-all duration-300 ease-in-out overflow-hidden border-b",
          blurred ? "backdrop-blur-lg border-secondary/10" : "border-transparent",
        )}
      >
        <div className="flex size-full items-center justify-between px-4 relative z-10">
          <div className="flex items-center gap-3">
            <Tooltip open={showGreeting}>
              <TooltipTrigger>
                <Link
                  to="/"
                  className="flex items-center gap-0 group focus:outline-none"
                  onMouseEnter={() => setIsLogoHovered(true)}
                  onMouseLeave={() => setIsLogoHovered(false)}
                  prefetch="intent"
                >
                  <Logo
                    className="size-4 md:size-6 text-muted-foreground group-hover:text-foreground group-focus:text-foreground transition-colors duration-300 group-hover:duration-200 ease-in-out delay-200 group-hover:delay-75"
                    isHovered={isLogoHovered}
                  />
                  <span className="sr-only">Framerate</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8} className="max-w-70 md:max-w-none text-center">
                {greetingMessage}
              </TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-1 md:hidden">
              <Button variant="link" className="p-0 m-0">
                <Link to="/explorar" className="flex items-center gap-1.5" prefetch="intent">
                  <IconCompass className="size-4" />
                </Link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger className={cn(buttonVariants({ variant: "link" }), "p-0 m-0")}>
                  <IconCpu className="size-4" />
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-56 mt-2">
                  {categories && categories.length > 0 ? (
                    categories.map((c) => {
                      const categoryConfig = getCategoryConfig(c.slug);
                      return (
                        <DropdownMenuItem key={c.id}>
                          <Link
                            to={`/categoria/${categoryConfig.urlSlug}`}
                            viewTransition
                            className="cursor-pointer"
                            prefetch="intent"
                          >
                            {categoryConfig.label}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })
                  ) : (
                    <DropdownMenuItem disabled>{t("no_categories")}</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
            <Button variant="link" className="p-0 m-0">
              <Link to="/explorar" className="flex items-center gap-1.5" prefetch="intent">
                <IconCompass className="size-4" />
                <span>{t("explore")}</span>
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger className={cn(buttonVariants({ variant: "link" }))}>
                <IconCpu className="size-4" />
                <span>{t("hardware")}</span>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="center" className="w-56 mt-2">
                {categories && categories.length > 0 ? (
                  categories.map((c) => {
                    const categoryConfig = getCategoryConfig(c.slug);
                    return (
                      <DropdownMenuItem key={c.id}>
                        <Link
                          to={`/categoria/${categoryConfig.urlSlug}`}
                          viewTransition
                          className="cursor-pointer"
                          prefetch="intent"
                        >
                          {categoryConfig.label}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })
                ) : (
                  <DropdownMenuItem disabled>{t("no_categories")}</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <CreateQuoteDialog
                trigger={
                  <Button
                    variant={"link"}
                    className={"hidden sm:flex p-0 m-0 outline-offset-4 cursor-pointer"}
                    size={"sm"}
                  >
                    {t("create_quote")}
                  </Button>
                }
              />
            ) : null}

            <Tooltip>
              <TooltipTrigger>
                <SearchTrigger />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="px-2 py-1">
                <div className="flex items-center gap-2">
                  <span>{t("search")}</span>
                  <kbd className="rounded-4xl text-xs">Ctrl+K</kbd>
                </div>
              </TooltipContent>
            </Tooltip>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={t("user")}
                  className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full p-0")}
                >
                  {profile?.avatar_url || user.user_metadata?.avatar_url ? (
                    <AsyncImage
                      src={profile?.avatar_url || user.user_metadata?.avatar_url}
                      alt={profile?.full_name || user.user_metadata?.name || user.email || "avatar"}
                      className="size-6 rounded-full object-cover"
                    />
                  ) : (
                    <IconUserCircle className="size-6 text-muted-foreground" />
                  )}
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-69 mt-2 text-base rounded-xl">
                  <DropdownMenuItem className="cursor-default select-none p-0">
                    <Link
                      to={profile?.username ? `/u/${profile.username}` : "/profile"}
                      className="block"
                      prefetch="intent"
                    >
                      <div className="flex items-center gap-3 px-3 py-3">
                        {profile?.avatar_url || user.user_metadata?.avatar_url ? (
                          <AsyncImage
                            src={profile?.avatar_url || user.user_metadata?.avatar_url}
                            alt={profile?.full_name || user.user_metadata?.name || user.email || "avatar"}
                            className="size-12 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="size-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <IconUserCircle className="size-7 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex flex-col min-w-0 flex-1">
                          <p className="text-base font-medium truncate">
                            {profile?.full_name ||
                              profile?.username ||
                              user.user_metadata?.full_name ||
                              user.user_metadata?.name ||
                              t("user")}
                          </p>
                          {user.email && <p className="text-sm text-muted-foreground truncate">{user.email}</p>}
                        </div>
                      </div>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuGroup>
                    <DropdownMenuItem>
                      <Link
                        to={profile?.username ? `/u/${profile.username}` : "/profile"}
                        className="flex items-center gap-2.5 w-full"
                        prefetch="intent"
                      >
                        <IconUserCircle className="size-5" />
                        <span>{t("profile")}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link to="/settings" className="flex items-center gap-2.5 w-full" prefetch="intent">
                        <IconSettings className="size-5" />
                        <span>{t("settings")}</span>
                      </Link>
                    </DropdownMenuItem>

                    <form method="post" action="/action/auth">
                      <input type="hidden" name="action" value="logout" />
                      <DropdownMenuItem className={"cursor-pointer"}>
                        <button type="submit" className="flex items-center gap-2.5 w-full cursor-pointer">
                          <IconLogout className="size-5" />
                          <span>{t("logout")}</span>
                        </button>
                      </DropdownMenuItem>
                    </form>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={t("login")}
                  className={cn(
                    buttonVariants({
                      variant: "default",
                      size: "sm",
                    }),
                    "md:px-6 md:h-8",
                  )}
                >
                  <IconLogin className="size-4 mr-2" />
                  {t("login")}
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-64 mt-2 bg-card ">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className={"text-primary"}>{t("login")}</DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <div className="px-3 pb-2">
                    <p className="text-xs text-muted-foreground">{t("login_desc")}</p>
                  </div>

                  <DropdownMenuSeparator />

                  <DropdownMenuGroup>
                    <form method="post" action="/action/auth" className="w-full">
                      <input type="hidden" name="action" value="login" />
                      <input type="hidden" name="provider" value="discord" />
                      <input type="hidden" name="returnTo" value={currentPath} />
                      <DropdownMenuItem className={"cursor-pointer"}>
                        <button type="submit" className="flex items-center gap-2.5 w-full cursor-pointer">
                          <Discord className="size-4" />
                          <span>{t("continue_with", { provider: "Discord" })}</span>
                        </button>
                      </DropdownMenuItem>
                    </form>

                    <form method="post" action="/action/auth" className="w-full">
                      <input type="hidden" name="action" value="login" />
                      <input type="hidden" name="provider" value="google" />
                      <input type="hidden" name="returnTo" value={currentPath} />
                      <DropdownMenuItem className={"cursor-pointer"}>
                        <button type="submit" className="flex items-center gap-2.5 w-full cursor-pointer">
                          <Google className="size-4" />
                          <span>{t("continue_with", { provider: "Google" })}</span>
                        </button>
                      </DropdownMenuItem>
                    </form>

                    <form method="post" action="/action/auth" className="w-full">
                      <input type="hidden" name="action" value="login" />
                      <input type="hidden" name="provider" value="apple" />
                      <input type="hidden" name="returnTo" value={currentPath} />
                      <DropdownMenuItem className={"cursor-pointer"}>
                        <button type="submit" className="flex items-center gap-2.5 w-full cursor-pointer">
                          <Apple className="size-4 invert dark:invert-0" />
                          <span>{t("continue_with", { provider: "Apple" })}</span>
                        </button>
                      </DropdownMenuItem>
                    </form>

                    <form method="post" action="/action/auth" className="w-full">
                      <input type="hidden" name="action" value="login" />
                      <input type="hidden" name="provider" value="facebook" />
                      <input type="hidden" name="returnTo" value={currentPath} />
                      <DropdownMenuItem className={"cursor-pointer"}>
                        <button type="submit" className="flex items-center gap-2.5 w-full cursor-pointer">
                          <Facebook className="size-4" />
                          <span>{t("continue_with", { provider: "Facebook" })}</span>
                        </button>
                      </DropdownMenuItem>
                    </form>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  <div className="px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      Al continuar, aceptas nuestros{" "}
                      <Link to="/terms" className="underline hover:text-foreground" prefetch="intent">
                        {t("terms")}
                      </Link>{" "}
                      y{" "}
                      <Link to="/privacy" className="underline hover:text-foreground" prefetch="intent">
                        {t("privacy")}
                      </Link>
                    </p>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
