import { IconCompass, IconCpu, IconLogin, IconLogout, IconSettings, IconUserCircle } from "@tabler/icons-react";
import { domAnimation, LazyMotion, m, useTransform } from "motion/react";
import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { Link, useLocation } from "react-router";
import { useProfile, useUser } from "~/features/auth/hooks/useAuth";
import type { Category } from "~/features/category/services/categories";
import { getCategoryConfig } from "~/features/category/utils/categories";
import { CreateQuoteDialog } from "~/features/quote/components/create-quote-dialog";
import { Apple } from "~/shared/components/icons/apple";
import { Discord } from "~/shared/components/icons/discord";
import { Facebook } from "~/shared/components/icons/facebook";
import { Google } from "~/shared/components/icons/google";
import { Logo } from "~/shared/components/layout/logo";
import { navTargetWidth } from "~/shared/components/layout/morph-search";
import { useMediaQuery } from "~/shared/hooks/use-media-query";
import { useMorphState } from "~/shared/hooks/use-morph-state";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";
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

const GRADIENT_FADE_MS = 700;

// --- Reducer para colapsar el grupo de estados time-of-day / greeting / gradient.
// Antes había 5 useState que se actualizaban en cascada dentro de un mismo useEffect,
// generando renders redundantes. Ahora cada transición es un único dispatch atómico.

type NavState = {
  timeOfDay: TimeOfDay;
  greetingMessage: string;
  showGreeting: boolean;
  visibleGradient: string;
  gradientVisible: boolean;
};

type NavAction =
  | { type: "tick"; timeOfDay: TimeOfDay; greeting: string }
  | { type: "show-greeting" }
  | { type: "hide-greeting" }
  | { type: "gradient-replace"; target: string; visible: boolean }
  | { type: "gradient-fade-out" }
  | { type: "gradient-fade-in"; visible: boolean };

const initialNavState: NavState = {
  timeOfDay: "afternoon",
  greetingMessage: "",
  showGreeting: false,
  visibleGradient: "transparent",
  gradientVisible: false,
};

function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case "tick":
      return { ...state, timeOfDay: action.timeOfDay, greetingMessage: action.greeting };
    case "show-greeting":
      return state.showGreeting ? state : { ...state, showGreeting: true };
    case "hide-greeting":
      return state.showGreeting ? { ...state, showGreeting: false } : state;
    case "gradient-replace":
      return { ...state, visibleGradient: action.target, gradientVisible: action.visible };
    case "gradient-fade-out":
      return state.gradientVisible ? { ...state, gradientVisible: false } : state;
    case "gradient-fade-in":
      return state.gradientVisible === action.visible ? state : { ...state, gradientVisible: action.visible };
    default:
      return state;
  }
}

// --- useSyncExternalStore: leemos location.pathname + search sin un useEffect
// que cause flicker. Server snapshot devuelve "/" (placeholder estable); el
// cliente lo reemplaza inmediatamente al hidratar.
function subscribeToLocation(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

function getLocationSnapshot() {
  return window.location.pathname + window.location.search;
}

function getServerLocationSnapshot() {
  return "/";
}

export function Navbar({ categories, blurred }: NavbarProps) {
  const user = useUser();
  const profile = useProfile();
  const { t } = useTranslation();
  const location = useLocation();

  // El ancla del buscador sólo existe en la landing (donde está el hero que lo
  // origina). ≥1024px: ancla inline que crece su ancho con el scroll y separa
  // Explorar/Hardware. <1024px: segunda fila (doble navbar) que se abre con el
  // scroll. El campo real flota encima vía MorphSearch (interpolación continua).
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const showAnchor = location.pathname === "/";
  // `e` one-shot 0↔1 (200ms al cruzar el umbral). El ancla crece su ancho y la
  // fila móvil su alto en sincronía con el morph del campo (mismo driver).
  const e = useMorphState();
  const navAnchorW = useTransform(
    e,
    (k) => k * navTargetWidth(typeof window !== "undefined" ? window.innerWidth : 1280, isDesktop),
  );
  const mobileBarH = useTransform(e, [0, 1], [0, 56]);

  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [state, dispatch] = useReducer(navReducer, initialNavState);
  const { timeOfDay, greetingMessage, showGreeting, visibleGradient, gradientVisible } = state;

  // currentPath se lee desde window de forma reactiva; suppressHydrationWarning
  // en el <input> donde se pinta evita warning durante el primer paint.
  const currentPath = useSyncExternalStore(subscribeToLocation, getLocationSnapshot, getServerLocationSnapshot);

  // mantenemos en ref el `t` actual para que el setInterval no se recree en cada
  // cambio de idioma sin perder el último traductor disponible.
  const tRef = useRef(t);
  tRef.current = t;

  void categories;

  useEffect(() => {
    const tick = () => {
      const newTimeOfDay = getTimeOfDay();
      const randomIndex = Math.floor(Math.random() * 5) + 1;
      dispatch({
        type: "tick",
        timeOfDay: newTimeOfDay,
        greeting: tRef.current(`greeting_${newTimeOfDay}_${randomIndex}`),
      });
    };

    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const target = GRADIENTS[timeOfDay] ?? "transparent";
    let fadeOutTimer: number | undefined;
    let fadeInTimer: number | undefined;

    if (visibleGradient === "transparent" && !gradientVisible) {
      dispatch({ type: "gradient-replace", target, visible: false });
      fadeInTimer = window.setTimeout(() => dispatch({ type: "gradient-fade-in", visible: true }), 50);
      return () => {
        if (fadeInTimer) clearTimeout(fadeInTimer);
      };
    }

    if (visibleGradient === target) {
      dispatch({ type: "gradient-fade-in", visible: true });
      return;
    }

    dispatch({ type: "gradient-fade-out" });
    fadeOutTimer = window.setTimeout(() => {
      dispatch({ type: "gradient-replace", target, visible: false });
      fadeInTimer = window.setTimeout(() => dispatch({ type: "gradient-fade-in", visible: true }), 50);
    }, GRADIENT_FADE_MS);

    return () => {
      if (fadeOutTimer) clearTimeout(fadeOutTimer);
      if (fadeInTimer) clearTimeout(fadeInTimer);
    };
  }, [timeOfDay, gradientVisible, visibleGradient]);

  // mostrar mensaje despues de que la pagina haya cargado completamente
  useEffect(() => {
    const SHOW_DELAY = 500;
    const VISIBLE_MS = 12000;

    const showSequence = () => {
      const showTimer = setTimeout(() => dispatch({ type: "show-greeting" }), SHOW_DELAY);
      const hideTimer = setTimeout(() => dispatch({ type: "hide-greeting" }), SHOW_DELAY + VISIBLE_MS);

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
          // Al hacer scroll deja de ser blur translúcido (se sentía débil) y
          // pasa a la misma superficie sólida que la barra de búsqueda móvil.
          blurred ? "bg-background/90 backdrop-blur-md border-border" : "border-transparent",
        )}
      >
        <div className="flex size-full items-center justify-between px-4 relative z-10">
          <div className="flex items-center gap-3">
            <Tooltip open={showGreeting}>
              <TooltipTrigger
                render={
                  <Link
                    to="/"
                    className="flex items-center gap-0 group focus:outline-none"
                    onMouseEnter={() => setIsLogoHovered(true)}
                    onMouseLeave={() => setIsLogoHovered(false)}
                    prefetch="intent"
                  />
                }
              >
                <Logo
                  className="size-4 md:size-6 text-muted-foreground group-hover:text-foreground group-focus:text-foreground transition-colors duration-300 group-hover:duration-200 ease-in-out delay-200 group-hover:delay-75"
                  isHovered={isLogoHovered}
                />
                <span className="sr-only">Framerate</span>
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

          {/* Centro absoluto sin transform (no choca con la proyección de
              Framer). El ancla B invisible crece su ancho con el progreso de
              scroll y empuja Explorar/Hardware hacia los lados; el campo real
              (MorphSearch) flota encima e interpola su caja de forma continua. */}
          <LazyMotion features={domAnimation}>
            <div className="hidden md:flex items-center gap-6 absolute inset-x-0 mx-auto w-max">
              <Button variant="link" className="p-0 m-0">
                <Link to="/explorar" className="flex items-center gap-1.5" prefetch="intent">
                  <IconCompass className="size-4" />
                  <span>{t("explore")}</span>
                </Link>
              </Button>

              {showAnchor && isDesktop && (
                <m.div id="nav-search-anchor" aria-hidden style={{ width: navAnchorW }} className="h-9 shrink-0" />
              )}

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
          </LazyMotion>

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

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={t("user")}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "rounded-full p-0",
                    // Suaviza el foco: el ring de 3px + border-ring de buttonVariants
                    // se ve muy fuerte (blanco puro en dark) alrededor del avatar.
                    "focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-transparent",
                  )}
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
                      <div className="flex items-center gap-3 p-3">
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

      {/* Doble navbar en móvil/tablet: el buscador no cabe inline, así que la
          segunda fila se ABRE con el scroll (alto ligado al progreso) y el
          campo real (MorphSearch) se interpola hasta el ancla de adentro. */}
      {showAnchor && !isDesktop && (
        <LazyMotion features={domAnimation}>
          <m.div
            style={{ height: mobileBarH }}
            className="lg:hidden w-full overflow-hidden bg-background/90 backdrop-blur-md"
          >
            <div id="nav-search-anchor" aria-hidden className="mx-4 my-[10px] h-9" />
          </m.div>
        </LazyMotion>
      )}
    </>
  );
}
