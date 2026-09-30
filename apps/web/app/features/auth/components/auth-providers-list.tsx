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
    <div className={cn("flex flex-col gap-1", className)}>
      {providers.map(({ id, label }) => (
        <form key={id} method="post" action="/action/auth" className="w-full">
          <input type="hidden" name="action" value="login" />
          <input type="hidden" name="provider" value={id} />
          <input type="hidden" name="returnTo" value={path} />
          <button
            type="submit"
            className={cn(
              "flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-md cursor-pointer",
              "text-foreground hover:bg-secondary transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
