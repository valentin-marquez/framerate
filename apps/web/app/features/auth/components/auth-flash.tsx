import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { useAuthProviders } from "~/features/auth/hooks/useAuth";
import { useTranslation } from "~/shared/hooks/use-translation";

export const ALREADY_LINKED = "account_already_linked_to_different_user";

// Códigos de Better Auth (`?error=`) con mensaje propio; el resto cae en el genérico de login o de conexión.
const ERROR_KEYS: Record<string, string> = {
  account_not_linked: "auth_error_account_not_linked",
  [ALREADY_LINKED]: "auth_error_already_linked",
};

const FLASH_PARAMS = ["error", "error_description", "conectada", "conectar", "unidas"];

/** Avisa lo que dejó en la URL la vuelta de OAuth (`?error=`, `?conectada=`, `?unidas`) y limpia esos parámetros. */
export function AuthFlash() {
  const [params, setParams] = useSearchParams();
  const providers = useAuthProviders();
  const { t } = useTranslation();
  const error = params.get("error");
  const connected = params.get("conectada");
  const linking = params.has("conectar");
  const merged = params.has("unidas");

  useEffect(() => {
    if (error === "access_denied") {
      // Cancelaste en la pantalla del proveedor: no es un error.
      toast(t("auth_cancelled"), { id: "auth-flash" });
    } else if (error) {
      // Al conectar, ese error lo explica ConnectedAccounts con la oferta de unir las cuentas.
      if (!(linking && error === ALREADY_LINKED)) {
        toast.error(t(ERROR_KEYS[error] ?? (linking ? "account_link_error" : "auth_error_login")), {
          id: "auth-flash",
        });
      }
    } else if (connected) {
      const provider = providers.find((p) => p.id === connected)?.label ?? connected;
      toast.success(t("account_connected_toast", { provider }), { id: "auth-flash" });
    } else if (merged) {
      toast.success(t("merge_done_toast"), { id: "auth-flash" });
    } else {
      return;
    }
    setParams(
      (next) => {
        for (const key of FLASH_PARAMS) next.delete(key);
        return next;
      },
      { replace: true, preventScrollReset: true, unstable_defaultShouldRevalidate: false },
    );
  }, [error, connected, linking, merged, providers, setParams, t]);

  return null;
}
