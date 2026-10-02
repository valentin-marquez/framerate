import type { CategoryItem } from "@framerate/contracts";
import { IconCompass, IconCpu, IconLogout, IconSettings, IconUserCircle } from "@tabler/icons-react";
import { useEffect, useReducer, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { LoginDialog } from "~/features/auth/components/login-dialog";
import { useProfile, useUser } from "~/features/auth/hooks/useAuth";
import { CreateQuoteDialog } from "~/features/quote/components/create-quote-dialog";
import { MyStoresMenu } from "~/features/stores/components/my-stores-menu";
import { AdminMenu } from "~/shared/components/layout/admin-menu";
import { Logo } from "~/shared/components/layout/logo";
import { NavClock, NavTab, navTabClass } from "~/shared/components/layout/nav-parts";
import { SiteSearch } from "~/shared/components/layout/site-search";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";

interface NavbarProps {
  categories: CategoryItem[];
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

export function Navbar({ categories, blurred }: NavbarProps) {
  const user = useUser();
  const profile = useProfile();
  const { t } = useTranslation();
  const location = useLocation();
  const onExplore = location.pathname.startsWith("/explorar");
  const onCategory = location.pathname.startsWith("/categoria");

  // Sólo la home tiene el buscador del hero que se acopla al navbar (reglas `.nav-search` de app.css).
  const isHome = location.pathname === "/";

  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [state, dispatch] = useReducer(navReducer, initialNavState);
  const { timeOfDay, greetingMessage, showGreeting, visibleGradient, gradientVisible } = state;

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

            <div className="flex items-center gap-3 md:hidden">
              <NavTab to="/explorar" icon={IconCompass} label={t("explore")} active={onExplore} iconOnly />

              <DropdownMenu>
                <DropdownMenuTrigger aria-label={t("hardware")} className={navTabClass(onCategory)}>
                  <IconCpu className="size-4" stroke={1.75} />
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-56 mt-2">
                  {categories && categories.length > 0 ? (
                    categories.map((c) => (
                      <DropdownMenuItem key={c.id}>
                        <Link to={`/categoria/${c.slug}`} viewTransition className="cursor-pointer" prefetch="intent">
                          {c.label}
                        </Link>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>{t("no_categories")}</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* En la home, con el buscador acoplado, `.nav-search-start/end` apartan Explorar y Hardware (app.css). */}
          <div className="hidden md:flex items-center gap-6 absolute inset-x-0 mx-auto w-max">
            <div className="nav-search-start">
              <NavTab to="/explorar" icon={IconCompass} label={t("explore")} active={onExplore} />
            </div>

            <div className="nav-search-end">
              <DropdownMenu>
                <DropdownMenuTrigger className={navTabClass(onCategory)}>
                  <IconCpu className="size-4" stroke={1.75} />
                  <span>{t("hardware")}</span>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="center" className="w-56 mt-2">
                  {categories && categories.length > 0 ? (
                    categories.map((c) => (
                      <DropdownMenuItem key={c.id}>
                        <Link to={`/categoria/${c.slug}`} viewTransition className="cursor-pointer" prefetch="intent">
                          {c.label}
                        </Link>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>{t("no_categories")}</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <NavClock className="hidden lg:inline-block" />
            {user ? (
              <CreateQuoteDialog
                trigger={
                  <button
                    type="button"
                    className="hidden cursor-pointer font-medium text-foreground/60 text-sm transition-colors hover:text-foreground sm:block"
                  >
                    {t("create_quote")}
                  </button>
                }
              />
            ) : null}

            {user ? (
              // `key` distinta por rama: ambas ramas del ternario renderizan
              // <DropdownMenu> en la misma posición JSX. Sin keys, React reusa
              // la misma instancia de MenuRoot al cambiar `user` y el prop
              // `open` salta controlled↔uncontrolled (warning de Base UI).
              <DropdownMenu key="user-menu" open={userMenuOpen} onOpenChange={setUserMenuOpen}>
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
                  {profile?.avatar_url ? (
                    <AsyncImage
                      src={profile?.avatar_url}
                      alt={profile?.full_name || user.email || "avatar"}
                      className="size-6 rounded-full object-cover"
                    />
                  ) : (
                    <IconUserCircle className="size-6 text-muted-foreground" />
                  )}
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-69 mt-2 text-base rounded-xl">
                  <DropdownMenuItem className="cursor-default select-none p-0">
                    <Link
                      to={profile?.username ? `/u/${profile.username}` : "/perfil"}
                      className="block"
                      prefetch="intent"
                    >
                      <div className="flex items-center gap-3 p-3">
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
                          <p className="text-base font-medium truncate">
                            {profile?.full_name || profile?.username || t("user")}
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
                        to={profile?.username ? `/u/${profile.username}` : "/perfil"}
                        className="flex items-center gap-2.5 w-full"
                        prefetch="intent"
                      >
                        <IconUserCircle className="size-5" />
                        <span>{t("profile")}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link to="/ajustes" className="flex items-center gap-2.5 w-full" prefetch="intent">
                        <IconSettings className="size-5" />
                        <span>{t("settings")}</span>
                      </Link>
                    </DropdownMenuItem>

                    {/* Sólo se monta cuando el dropdown está abierto: evita un */}
                    {/* fetch innecesario al cargar la navbar para users sin tiendas. */}
                    {userMenuOpen && <MyStoresMenu enabled={userMenuOpen} />}
                    {userMenuOpen && <AdminMenu enabled={userMenuOpen} />}

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
              <LoginDialog
                trigger={
                  <button
                    type="button"
                    className="inline-flex h-8 cursor-pointer items-center rounded-full bg-secondary px-3.5 font-medium text-foreground text-sm transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    {t("login")}
                  </button>
                }
              />
            )}
          </div>
        </div>
      </nav>

      {/* Bajo lg el campo no cabe en el navbar: va en una segunda fila, encima del contenido para no correrlo. Desde lg
          queda al centro del navbar. Se posiciona contra el <header> sticky de root.tsx. */}
      {isHome && (
        <div className="nav-search absolute inset-x-0 top-full bg-background/90 px-4 py-2.5 backdrop-blur-md lg:top-2 lg:z-50 lg:mx-auto lg:w-(--nav-search-w) lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <SiteSearch id="nav-search" className="h-9 rounded-xl" />
        </div>
      )}
    </>
  );
}
