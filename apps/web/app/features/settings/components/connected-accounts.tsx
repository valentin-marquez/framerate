import { type Icon, IconBrandDiscord, IconBrandGoogle, IconLink, IconLoader2 } from "@tabler/icons-react";
import { useEffect } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { useAuthProviders } from "~/features/auth/hooks/useAuth";
import { Button } from "~/shared/components/primitives/button";
import { useTranslation } from "~/shared/hooks/use-translation";
import { SettingsBadge, SettingsGroup, SettingsRow, SettingsSection } from "./settings-parts";

/** Cuenta de Better Auth (`GET /v1/auth/list-accounts`): `id` es el que pide `unlink-account`. */
export interface LinkedAccount {
  id: string;
  providerId: string;
}

const ICONS: Record<string, Icon> = { discord: IconBrandDiscord, google: IconBrandGoogle };

/** Proveedores de login: cuáles están conectados a tu usuario, conectar los que faltan o soltar uno. */
export function ConnectedAccounts({ accounts }: { accounts: LinkedAccount[] | null }) {
  const { t } = useTranslation();
  const providers = useAuthProviders();
  // Sólo cuentan los proveedores habilitados: soltar uno nunca te deja con una cuenta que ya no sirve para entrar.
  const connected = accounts?.filter((a) => providers.some((p) => p.id === a.providerId)) ?? [];

  return (
    <SettingsSection title={t("connected_accounts")} description={t("connected_accounts_desc")}>
      {accounts ? (
        <SettingsGroup>
          {providers.map((provider) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              account={connected.find((a) => a.providerId === provider.id)}
              canUnlink={connected.length > 1}
            />
          ))}
        </SettingsGroup>
      ) : (
        <p className="text-muted-foreground text-sm">{t("connected_accounts_load_error")}</p>
      )}
    </SettingsSection>
  );
}

function ProviderRow({
  provider,
  account,
  canUnlink,
}: {
  provider: { id: string; label: string };
  account?: LinkedAccount;
  canUnlink: boolean;
}) {
  const { t } = useTranslation();
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.error) toast.error(t(fetcher.data.error));
    else if (fetcher.data?.ok) toast.success(t("account_disconnected_toast", { provider: provider.label }));
  }, [fetcher.data, provider.label, t]);

  return (
    <SettingsRow
      icon={ICONS[provider.id] ?? IconLink}
      title={provider.label}
      badge={account && <SettingsBadge>{t("account_connected")}</SettingsBadge>}
      action={
        (!account || canUnlink) && (
          <fetcher.Form method="post" action="/action/auth">
            <input type="hidden" name="action" value={account ? "unlink" : "link"} />
            {account ? (
              <input type="hidden" name="accountId" value={account.id} />
            ) : (
              <input type="hidden" name="provider" value={provider.id} />
            )}
            <Button
              type="submit"
              size="sm"
              variant={account ? "ghost" : "default"}
              disabled={busy}
              aria-label={t(account ? "disconnect_provider" : "connect_provider", { provider: provider.label })}
            >
              {busy && <IconLoader2 className="animate-spin" />}
              {t(account ? "disconnect" : "connect")}
            </Button>
          </fetcher.Form>
        )
      }
    />
  );
}
