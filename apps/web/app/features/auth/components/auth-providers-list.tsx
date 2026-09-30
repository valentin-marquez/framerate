import { useEffect, useState } from "react";
import { ProviderIcon } from "~/features/auth/components/provider-icons";
import { useAuthProviders } from "~/features/auth/hooks/useAuth";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";

interface AuthProvidersListProps {
  /** Path to return to after login. Defaults to current location at mount time. */
  returnTo?: string;
  className?: string;
}

/** Un botón por proveedor habilitado; el primero es la acción principal. */
export function AuthProvidersList({ returnTo, className }: AuthProvidersListProps) {
  const { t } = useTranslation();
  const providers = useAuthProviders();
  // returnTo cae en window.location en cliente. SSR-safe: si no hay window, "/".
  const [path, setPath] = useState<string>(returnTo || "/");

  useEffect(() => {
    if (returnTo) return;
    if (typeof window !== "undefined") {
      setPath(window.location.pathname + window.location.search);
    }
  }, [returnTo]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {providers.map(({ id, label }, i) => (
        <form key={id} method="post" action="/action/auth" className="w-full">
          <input type="hidden" name="action" value="login" />
          <input type="hidden" name="provider" value={id} />
          <input type="hidden" name="returnTo" value={path} />
          <button
            type="submit"
            className={cn(
              "flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 font-medium text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              i === 0
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-secondary text-foreground/70 hover:bg-secondary/70 hover:text-foreground",
            )}
          >
            <ProviderIcon id={id} />
            <span>{t("continue_with", { provider: label })}</span>
          </button>
        </form>
      ))}
    </div>
  );
}
