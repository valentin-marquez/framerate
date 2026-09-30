import {
  type Icon,
  IconBrandDiscord,
  IconBrandGoogle,
  IconChevronDown,
  IconLink,
  IconLoader2,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useFetcher, useSearchParams, useSubmit } from "react-router";
import { toast } from "sonner";
import { ALREADY_LINKED } from "~/features/auth/components/auth-flash";
import { useAuthProviders } from "~/features/auth/hooks/useAuth";
import { Button, type ButtonProps } from "~/shared/components/primitives/button";
import { useTranslation } from "~/shared/hooks/use-translation";
import { SettingsBadge, SettingsGroup, SettingsRow, SettingsSection } from "./settings-parts";

/** Cuenta de Better Auth (`GET /v1/auth/list-accounts`): `id` es el que pide `unlink-account`. */
export interface LinkedAccount {
  id: string;
  providerId: string;
}

const ICONS: Record<string, Icon> = { discord: IconBrandDiscord, google: IconBrandGoogle };

/** Proveedores de login: cuáles están conectados a tu usuario, conectar los que faltan, soltar uno o unir usuarios. */
export function ConnectedAccounts({ accounts }: { accounts: LinkedAccount[] | null }) {
  const { t } = useTranslation();
  const providers = useAuthProviders();
  const [params] = useSearchParams();
  // Se toma al montar (también en el SSR): AuthFlash limpia la URL justo después.
  const [mergeOffer] = useState(() => (params.get("error") === ALREADY_LINKED ? params.get("conectar") : null));
  // Sólo cuentan los proveedores habilitados: soltar uno nunca te deja con una cuenta que ya no sirve para entrar.
  const connected = accounts?.filter((a) => providers.some((p) => p.id === a.providerId)) ?? [];
  const labelOf = (id: string) => providers.find((p) => p.id === id)?.label ?? id;

  if (!accounts) {
    return (
      <SettingsSection title={t("connected_accounts")} description={t("connected_accounts_desc")}>
        <p className="text-muted-foreground text-sm">{t("connected_accounts_load_error")}</p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection title={t("connected_accounts")} description={t("connected_accounts_desc")}>
      {mergeOffer && (
        <div className="flex flex-col gap-3 rounded-2xl bg-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-foreground text-sm">{t("merge_offer", { provider: labelOf(mergeOffer) })}</p>
          <AuthActionButton fields={{ action: "merge", provider: mergeOffer }}>{t("merge_accounts")}</AuthActionButton>
        </div>
      )}

      <SettingsGroup>
        {providers.map((provider) => {
          const account = connected.find((a) => a.providerId === provider.id);
          const label = { provider: provider.label };
          return (
            <SettingsRow
              key={provider.id}
              icon={ICONS[provider.id] ?? IconLink}
              title={provider.label}
              badge={account && <SettingsBadge>{t("account_connected")}</SettingsBadge>}
              action={
                account ? (
                  connected.length > 1 && (
                    <AuthActionButton
                      fields={{ action: "unlink", accountId: account.id }}
                      variant="ghost"
                      aria-label={t("disconnect_provider", label)}
                      success={t("account_disconnected_toast", label)}
                    >
                      {t("disconnect")}
                    </AuthActionButton>
                  )
                ) : (
                  <AuthActionButton
                    fields={{ action: "link", provider: provider.id }}
                    aria-label={t("connect_provider", label)}
                  >
                    {t("connect")}
                  </AuthActionButton>
                )
              }
            />
          );
        })}
      </SettingsGroup>

      <details className="group">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-md text-muted-foreground text-sm hover:text-foreground [&::-webkit-details-marker]:hidden">
          {t("merge_with_other")}
          <IconChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-muted-foreground text-sm">{t("merge_with_other_desc")}</p>
          <div className="flex flex-wrap gap-2">
            {providers.map((provider) => {
              const ProviderIcon = ICONS[provider.id] ?? IconLink;
              return (
                <AuthActionButton
                  key={provider.id}
                  fields={{ action: "merge", provider: provider.id }}
                  variant="secondary"
                >
                  <ProviderIcon />
                  {t("continue_with", { provider: provider.label })}
                </AuthActionButton>
              );
            })}
          </div>
        </div>
      </details>
    </SettingsSection>
  );
}

/** Envía una acción de `/action/auth` sin salir de la página (o sigue su redirect al proveedor); avisa si falla. */
function AuthActionButton({
  fields,
  success,
  children,
  ...props
}: { fields: Record<string, string>; success?: string } & ButtonProps) {
  const { t } = useTranslation();
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const submit = useSubmit();
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    const error = fetcher.data?.error;
    if (error === "account_unlink_not_fresh") {
      const logout = () => submit({ action: "logout" }, { method: "post", action: "/action/auth" });
      toast.error(t(error), { action: { label: t("logout"), onClick: logout } });
    } else if (error) {
      toast.error(t(error));
    } else if (fetcher.data?.ok && success) {
      toast.success(success);
    }
  }, [fetcher.data, success, submit, t]);

  return (
    <fetcher.Form method="post" action="/action/auth">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" size="sm" disabled={busy} {...props}>
        {busy && <IconLoader2 className="animate-spin" />}
        {children}
      </Button>
    </fetcher.Form>
  );
}
