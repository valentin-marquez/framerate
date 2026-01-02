import {
  IconCompass,
  IconCpu,
  IconLogin,
  IconLogout,
  IconSearch,
  IconSettings,
  IconUserCircle,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Apple } from "@/components/icons/apple";
import { Discord } from "@/components/icons/discord";
import { Facebook } from "@/components/icons/facebook";
import { Google } from "@/components/icons/google";
import { Logo } from "@/components/layout/logo";
import { useProfile, useUser } from "~/hooks/useAuth";
import { cn } from "~/lib/utils";
import type { Category } from "~/services/categories";
import { getCategoryConfig } from "~/utils/categories";
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

const GREETING_MESSAGES: Record<TimeOfDay, string[]> = {
  morning: [
    "¿Café o pasta térmica para desayunar?",
    "Los precios bajaron más rápido que tú de la cama",
    "Buen día, hoy sí sale ese procesador",
    "Menos lag y más café para empezar",
    "El que madruga, encuentra stock",
  ],
  afternoon: [
    "Mirar hardware también cuenta como trabajar",
    "Tu jefe no está mirando, busca esa GPU",
    "¿Otro ventilador? Nunca es suficiente",
    "El hambre pasa, los FPS son para siempre",
    "Solo una pieza más y juro que termino el build",
  ],
  evening: [
    "Prende el RGB que ya oscureció",
    "¿Tu PC brilla más que tu futuro? El mío sí",
    "Hora de los FPS altos y los precios bajos",
    "No es un gasto, es una inversión en felicidad",
    "Configurando el setup para ganar hoy",
  ],
  night: [
    "La luz del monitor cuenta como vitamina D",
    "Dormir es para gente con PCs lentas",
    "Tu cuenta bancaria dice no, pero tu build dice sí",
    "Un ojo en el código y otro en esa oferta",
    "Mañana ese precio será historia, cómpralo ya",
  ],
};

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 21) return "evening";
  return "night";
}

function getGreetingMessage(timeOfDay: TimeOfDay): string {
  const messages = GREETING_MESSAGES[timeOfDay];
  return messages[Math.floor(Math.random() * messages.length)];
}

export function Navbar({ categories, blurred }: NavbarProps) {
  const user = useUser();
  const profile = useProfile();
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("afternoon");
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [showGreeting, setShowGreeting] = useState(false);
  const [greetingMessage, setGreetingMessage] = useState("");

  // Gradient fade state
  const [visibleGradient, setVisibleGradient] = useState<string>("transparent");
  const [gradientVisible, setGradientVisible] = useState<boolean>(false);
  const GRADIENT_FADE_MS = 700;

  void categories;

  useEffect(() => {
    const currentTimeOfDay = getTimeOfDay();
    setTimeOfDay(currentTimeOfDay);
    setGreetingMessage(getGreetingMessage(currentTimeOfDay));

    const interval = setInterval(() => {
      const newTimeOfDay = getTimeOfDay();
      setTimeOfDay(newTimeOfDay);
      setGreetingMessage(getGreetingMessage(newTimeOfDay));
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Animate gradient
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

  // Show greeting after DOM is loaded
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
          {/* Left section: Logo + Nav items (mobile: together, desktop: logo only) */}
          <div className="flex items-center gap-3">
            <Tooltip open={showGreeting}>
              <TooltipTrigger>
                <Link
                  to="/"
                  className="flex items-center gap-0 group focus:outline-none"
                  onMouseEnter={() => setIsLogoHovered(true)}
                  onMouseLeave={() => setIsLogoHovered(false)}
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

            {/* Mobile navigation: show next to logo */}
            <div className="flex items-center gap-1 md:hidden">
              <Button variant="link" className="p-0 m-0">
                <Link to="/explorar" className="flex items-center gap-1.5">
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
                          <Link to={`/categoria/${categoryConfig.urlSlug}`} viewTransition className="cursor-pointer">
                            {categoryConfig.label}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })
                  ) : (
                    <DropdownMenuItem disabled>No hay categorías disponibles</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Center (desktop only): Navigation items */}
          <div className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
            <Button variant="link" className="p-0 m-0">
              <Link to="/explorar" className="flex items-center gap-1.5">
                <IconCompass className="size-4" />
                <span>Explorar</span>
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger className={cn(buttonVariants({ variant: "link" }))}>
                <IconCpu className="size-4" />
                <span>Hardware</span>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="center" className="w-56 mt-2">
                {categories && categories.length > 0 ? (
                  categories.map((c) => {
                    const categoryConfig = getCategoryConfig(c.slug);
                    return (
                      <DropdownMenuItem key={c.id}>
                        <Link to={`/categoria/${categoryConfig.urlSlug}`} viewTransition className="cursor-pointer">
                          {categoryConfig.label}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })
                ) : (
                  <DropdownMenuItem disabled>No hay categorías disponibles</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right section: Actions */}
          <div className="flex items-center gap-2">
            {user ? (
              <CreateQuoteDialog
                trigger={
                  <Button
                    variant={"link"}
                    className={"hidden sm:flex p-0 m-0 outline-offset-4 cursor-pointer"}
                    size={"sm"}
                  >
                    Crear Cotizacion
                  </Button>
                }
              />
            ) : null}

            {/* Search */}
            <Tooltip>
              <TooltipTrigger>
                <Button variant={"ghost"} aria-label="Buscar" size={"icon"} className={"rounded-full"}>
                  <IconSearch className="size-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="px-2 py-1">
                <div className="flex items-center gap-2">
                  <span>Buscador</span>
                  <kbd className="rounded-4xl text-xs">Ctrl+K</kbd>
                </div>
              </TooltipContent>
            </Tooltip>

            {/* User area */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Usuario"
                  className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full p-0")}
                >
                  {profile?.avatar_url || user.user_metadata?.avatar_url ? (
                    <img
                      src={profile?.avatar_url || user.user_metadata?.avatar_url}
                      alt={profile?.full_name || user.user_metadata?.name || user.email || "avatar"}
                      className="size-6 rounded-full object-cover"
                    />
                  ) : (
                    <IconUserCircle className="size-6 text-muted-foreground" />
                  )}
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-69 mt-2 text-base rounded-xl">
                  {/* User Info Section */}
                  <div className="flex items-center gap-3 px-3 py-3">
                    {profile?.avatar_url || user.user_metadata?.avatar_url ? (
                      <img
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
                          "Usuario"}
                      </p>
                      {user.email && <p className="text-sm text-muted-foreground truncate">{user.email}</p>}
                    </div>
                  </div>

                  <DropdownMenuSeparator />

                  <DropdownMenuGroup>
                    <DropdownMenuItem>
                      <Link
                        to={profile?.username ? `/u/${profile.username}` : "/profile"}
                        className="flex items-center gap-2.5 w-full"
                      >
                        <IconUserCircle className="size-5" />
                        <span>Perfil</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link to="/settings" className="flex items-center gap-2.5 w-full">
                        <IconSettings className="size-5" />
                        <span>Ajustes</span>
                      </Link>
                    </DropdownMenuItem>

                    <form method="post" action="/action/auth">
                      <input type="hidden" name="action" value="logout" />
                      <DropdownMenuItem className={"cursor-pointer"}>
                        <button type="submit" className="flex items-center gap-2.5 w-full cursor-pointer">
                          <IconLogout className="size-5" />
                          <span>Cerrar sesión</span>
                        </button>
                      </DropdownMenuItem>
                    </form>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Entrar"
                  className={cn(
                    buttonVariants({
                      variant: "secondary",
                      size: "sm",
                    }),
                    "md:px-6 md:h-8",
                  )}
                >
                  <IconLogin className="size-4 mr-2" />
                  Entrar
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-64 mt-2">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className={"text-primary"}>Entrar</DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <div className="px-3 pb-2">
                    <p className="text-xs text-muted-foreground">
                      Elige un proveedor para crear tu cuenta o iniciar sesión
                    </p>
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
                          <span>Continuar con Discord</span>
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
                          <span>Continuar con Google</span>
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
                          <span>Continuar con Apple</span>
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
                          <span>Continuar con Facebook</span>
                        </button>
                      </DropdownMenuItem>
                    </form>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  <div className="px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      Al continuar, aceptas nuestros{" "}
                      <Link to="/terms" className="underline hover:text-foreground">
                        Términos
                      </Link>{" "}
                      y{" "}
                      <Link to="/privacy" className="underline hover:text-foreground">
                        Privacidad
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
