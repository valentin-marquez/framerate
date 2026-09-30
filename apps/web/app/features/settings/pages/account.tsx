import { IconCircleCheck, IconLoader2, IconMail } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { toast } from "sonner";
import { getAuthUser, requireAuth } from "~/features/auth/services/auth.server";
import { useAuthStore } from "~/features/auth/store/auth";
import { meToProfile, profilesService } from "~/features/profile/services/profiles";
import { Button } from "~/shared/components/primitives/button";
import { ButtonGroup, ButtonGroupText } from "~/shared/components/primitives/button-group";
import { Input } from "~/shared/components/primitives/input";
import { InputGroup, InputGroupInput } from "~/shared/components/primitives/input-group";
import { Label } from "~/shared/components/primitives/label";
import { Textarea } from "~/shared/components/primitives/textarea";
import { useTranslation } from "~/shared/hooks/use-translation";
import { ApiError } from "~/shared/lib/api";
import { SettingsBadge, SettingsGroup, SettingsRow, SettingsSection } from "../components/settings-parts";
import type { Route } from "./+types/account";

const BIO_MAX = 280;

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getAuthUser(request);
  if (!user) throw new Response("Unauthorized", { status: 401 });

  return { profile: meToProfile(user), email: user.email };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);

  const formData = await request.formData();
  const fullName = formData.get("fullName") as string;
  const username = formData.get("username") as string;
  const rawBio = formData.get("bio");
  const bio = typeof rawBio === "string" ? rawBio.trim() : "";

  if (bio.length > BIO_MAX) {
    return { error: `Bio must be ${BIO_MAX} characters or fewer` };
  }

  try {
    const updatedProfile = await profilesService.updateMe({
      full_name: fullName,
      username: username,
      bio: bio.length === 0 ? null : bio,
    });

    return { success: true, profile: updatedProfile };
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    return { error: "Error al actualizar el perfil" };
  }
}

export default function AccountSettings({ loaderData, actionData }: Route.ComponentProps) {
  const { profile, email } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const toastIdRef = useRef<string | number | null>(null);
  const setProfile = useAuthStore((state) => state.setProfile);
  const { t } = useTranslation();

  // Mostrar toast de loading cuando se está enviando
  useEffect(() => {
    if (isSubmitting && !toastIdRef.current) {
      toastIdRef.current = toast.loading(t("saving_changes_toast"));
    }
  }, [isSubmitting, t]);

  // Actualizar toast a success/error cuando se recibe la respuesta
  useEffect(() => {
    if (toastIdRef.current && !isSubmitting) {
      if (actionData?.success) {
        toast.success(t("profile_updated_toast"), {
          id: toastIdRef.current,
        });

        // Actualizar el store con los nuevos datos del loader
        setProfile(actionData.profile || profile);
        toastIdRef.current = null;
      } else if (actionData?.error) {
        toast.error(
          actionData.error === "Error al actualizar el perfil" ? t("profile_update_error_toast") : actionData.error,
          {
            id: toastIdRef.current,
          },
        );
        toastIdRef.current = null;
      }
    }
  }, [actionData, isSubmitting, profile, setProfile, t]);

  return (
    <div className="space-y-8">
      <SettingsSection title={t("your_profile")} description={t("profile_desc")}>
        <Form method="post" className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="fullName">{t("full_name")}</Label>
              <Input
                id="fullName"
                name="fullName"
                defaultValue={profile.full_name || ""}
                placeholder={t("full_name_placeholder")}
                className="h-10"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="username">{t("username")}</Label>
              <ButtonGroup className="w-full">
                <ButtonGroupText>
                  <Label htmlFor="username">@</Label>
                </ButtonGroupText>
                <InputGroup className="h-10 w-full">
                  <InputGroupInput
                    id="username"
                    name="username"
                    defaultValue={profile.username || ""}
                    placeholder="usuario"
                  />
                </InputGroup>
              </ButtonGroup>
            </div>
          </div>

          <BioField defaultValue={profile.bio ?? ""} placeholder={t("bio_placeholder")} label={t("bio_label")} />

          <Button type="submit" disabled={isSubmitting} size="lg" className="w-full sm:w-auto">
            {isSubmitting ? <IconLoader2 className="size-4 animate-spin" /> : <IconCircleCheck className="size-4" />}
            {isSubmitting ? t("saving") : t("save_changes")}
          </Button>
        </Form>
      </SettingsSection>

      <SettingsSection title={t("emails")} description={t("emails_desc")}>
        <SettingsGroup>
          <SettingsRow
            icon={IconMail}
            title={email}
            badge={<SettingsBadge>{t("primary_email")}</SettingsBadge>}
            description={t("managed_by_provider")}
          />
        </SettingsGroup>
      </SettingsSection>
    </div>
  );
}

function BioField({ defaultValue, placeholder, label }: { defaultValue: string; placeholder: string; label: string }) {
  // Solo necesitamos el conteo para el contador visible. El <Textarea> es uncontrolled
  // (usa defaultValue), así que no derivamos un useState del prop — sólo trackeamos length.
  // Re-seed si defaultValue cambia (raro: el form se remontiza al navegar, pero curamos).
  // react-doctor-disable-next-line no-derived-useState -- prop re-seed via useRef es el patrón oficial de React docs
  const [length, setLength] = useState(defaultValue.length);
  const prevDefaultRef = useRef(defaultValue);
  if (defaultValue !== prevDefaultRef.current) {
    prevDefaultRef.current = defaultValue;
    setLength(defaultValue.length);
  }
  const remaining = BIO_MAX - length;
  const overLimit = remaining < 0;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="bio">{label}</Label>
        <span
          className={
            overLimit
              ? "text-xs tabular-nums text-destructive"
              : remaining <= 20
                ? "text-xs tabular-nums text-warn"
                : "text-xs tabular-nums text-muted-foreground"
          }
        >
          {remaining}
        </span>
      </div>
      <Textarea
        id="bio"
        name="bio"
        defaultValue={defaultValue}
        onChange={(e) => setLength(e.target.value.length)}
        placeholder={placeholder}
        maxLength={BIO_MAX + 50}
        rows={3}
        aria-invalid={overLimit || undefined}
      />
    </div>
  );
}
