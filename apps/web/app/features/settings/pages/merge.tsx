import { IconLoader2, IconUserCircle } from "@tabler/icons-react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { useAuthProviders, useUser } from "~/features/auth/hooks/useAuth";
import { callApi } from "~/features/auth/services/auth.server";
import { type MergePreview, type MergeUser, mergeApi } from "~/features/auth/services/merge.server";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { Button } from "~/shared/components/primitives/button";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";
import { SettingsBadge, SettingsGroup, SettingsSection } from "../components/settings-parts";
import type { Route } from "./+types/merge";

// Códigos de la API con mensaje propio (la clave de traducción es el mismo código).
const KNOWN_ERRORS = new Set(["merge_not_found", "merge_expired", "merge_same_user"]);
const errorKey = (code: string) => (KNOWN_ERRORS.has(code) ? code : "merge_error");

const COUNTS: (keyof MergePreview["counts"])[] = [
  "reviews",
  "comments",
  "organizations",
  "claims",
  "quotes",
  "tickets",
];

export function meta() {
  return [{ title: "Unir cuentas - Framerate" }, { name: "robots", content: "noindex, nofollow" }];
}

export function loader({ request }: Route.LoaderArgs) {
  return mergeApi.preview(request);
}

export async function action({ request }: Route.ActionArgs) {
  const intent = (await request.formData()).get("intent");

  if (intent === "confirm") {
    const { error, cookies } = await mergeApi.confirm(request);
    if (error) return data<{ error?: string; cancelled?: boolean }>({ error });
    // La API ya revocó las sesiones de la cuenta unida; sign-out borra además su cookie del navegador.
    const signOut = await callApi(request, "POST", "/v1/auth/sign-out", {});
    for (const cookie of signOut.cookies.getSetCookie()) cookies.append("set-cookie", cookie);
    return redirect("/?unidas=1", { headers: cookies });
  }

  const { error, cookies } = await mergeApi.cancel(request);
  return data<{ error?: string; cancelled?: boolean }>(error ? { error } : { cancelled: true }, { headers: cookies });
}

/** Resumen de la unión (con la sesión de la cuenta que se une): quién queda, qué se mueve y confirmar o cancelar. */
export default function MergeAccounts({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const user = useUser();
  const navigation = useNavigation();
  const pending = navigation.state === "submitting" ? navigation.formData?.get("intent") : null;

  if (actionData?.cancelled) {
    return (
      <SettingsSection
        title={t("merge_accounts")}
        description={t("merge_cancelled", { username: user?.username ?? "" })}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <form method="post" action="/action/auth">
            <input type="hidden" name="action" value="logout" />
            <Button type="submit" size="lg" className="w-full sm:w-auto">
              {t("logout")}
            </Button>
          </form>
          <Button size="lg" variant="ghost" nativeButton={false} render={<Link to="/ajustes/cuenta" />}>
            {t("merge_keep_session")}
          </Button>
        </div>
      </SettingsSection>
    );
  }

  if (!loaderData.preview) {
    return (
      <SettingsSection title={t("merge_accounts")} description={t(errorKey(loaderData.error))}>
        <Button size="lg" variant="secondary" nativeButton={false} render={<Link to="/ajustes/cuenta" />}>
          {t("merge_back")}
        </Button>
      </SettingsSection>
    );
  }

  const { survivor, absorbed, counts } = loaderData.preview;

  return (
    <div className="space-y-8">
      <SettingsSection title={t("merge_accounts")} description={t("merge_desc")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <UserCard label={t("merge_survivor")} user={survivor} />
          <UserCard label={t("merge_absorbed")} user={absorbed} leaving />
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("merge_moves_title")}
        description={t("merge_moves_desc", { username: survivor.username })}
      >
        <SettingsGroup>
          {COUNTS.map((key) => (
            <div key={key} className="flex items-center justify-between gap-4 px-4 py-3 text-sm sm:px-5">
              <span className="text-foreground">{t(`merge_count_${key}`)}</span>
              <span className={cn("font-medium tabular-nums", !counts[key] && "text-muted-foreground")}>
                {counts[key] ?? 0}
              </span>
            </div>
          ))}
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection title={t("merge_before_title")}>
        <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground text-sm">
          <li>{t("merge_note_absorbed", { username: absorbed.username })}</li>
          <li>{t("merge_note_providers", { username: survivor.username })}</li>
          <li>{t("merge_note_signout")}</li>
        </ul>
        {actionData?.error && (
          <p role="alert" className="text-destructive text-sm">
            {t(errorKey(actionData.error))}
          </p>
        )}
        <Form method="post" className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" name="intent" value="confirm" variant="destructive" size="lg" disabled={!!pending}>
            {pending === "confirm" && <IconLoader2 className="animate-spin" />}
            {t("merge_confirm", { username: absorbed.username })}
          </Button>
          <Button type="submit" name="intent" value="cancel" variant="ghost" size="lg" disabled={!!pending}>
            {pending === "cancel" && <IconLoader2 className="animate-spin" />}
            {t("merge_cancel")}
          </Button>
        </Form>
      </SettingsSection>
    </div>
  );
}

function UserCard({ label, user, leaving }: { label: string; user: MergeUser; leaving?: boolean }) {
  const providers = useAuthProviders();

  return (
    <div className={cn("space-y-3 rounded-2xl border border-border bg-card p-4", leaving && "border-dashed")}>
      <p className="font-medium text-muted-foreground text-xs">{label}</p>
      <div className="flex min-w-0 items-center gap-3">
        {user.avatarUrl ? (
          <AsyncImage src={user.avatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
        ) : (
          <IconUserCircle className="size-10 shrink-0 text-muted-foreground" stroke={1.25} />
        )}
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{user.displayName}</p>
          <p className="truncate text-muted-foreground text-sm">@{user.username}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {user.providers.map((id) => (
          <SettingsBadge key={id}>{providers.find((p) => p.id === id)?.label ?? id}</SettingsBadge>
        ))}
      </div>
    </div>
  );
}
