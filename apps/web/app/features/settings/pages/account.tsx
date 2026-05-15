import { IconLoader2 } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { toast } from "sonner";
import { getAuthUser, requireAuth } from "~/features/auth/services/auth.server";
import { useAuthStore } from "~/features/auth/store/auth";
import { profilesService } from "~/features/profile/services/profiles";
import { Button } from "~/shared/components/primitives/button";
import { ButtonGroup, ButtonGroupText } from "~/shared/components/primitives/button-group";
import { Input } from "~/shared/components/primitives/input";
import { InputGroup, InputGroupInput } from "~/shared/components/primitives/input-group";
import { Label } from "~/shared/components/primitives/label";
import { Separator } from "~/shared/components/primitives/separator";
import { Textarea } from "~/shared/components/primitives/textarea";
import { useTranslation } from "~/shared/hooks/use-translation";
import { ApiError } from "~/shared/lib/api";
import type { Route } from "./+types/account";

const BIO_MAX = 280;

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = await getAuthUser(request);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const profile = await profilesService.getMe(session.access_token);
  return { profile };
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase } = await requireAuth(request);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const fullName = formData.get("fullName") as string;
  const username = formData.get("username") as string;
  const rawBio = formData.get("bio");
  const bio = typeof rawBio === "string" ? rawBio.trim() : "";

  if (bio.length > BIO_MAX) {
    return { error: `Bio must be ${BIO_MAX} characters or fewer` };
  }

  try {
    const updatedProfile = await profilesService.updateMe(
      {
        full_name: fullName,
        username: username,
        bio: bio.length === 0 ? null : bio,
      },
      session.access_token,
    );

    return { success: true, profile: updatedProfile };
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    return { error: "Error al actualizar el perfil" };
  }
}

export default function AccountSettings({ loaderData, actionData }: Route.ComponentProps) {
  const { profile } = loaderData;
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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">{t("your_profile")}</h2>
        <p className="text-sm text-muted-foreground">{t("profile_desc")}</p>
      </div>

      <Separator />

      <Form method="post" className="space-y-8">
        <div className="flex flex-col md:flex-row-reverse gap-8">
          <div className="flex-1 space-y-4 w-full">
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
                <InputGroup className="w-full h-10">
                  <InputGroupInput
                    id="username"
                    name="username"
                    defaultValue={profile.username || ""}
                    placeholder="usuario"
                  />
                </InputGroup>
              </ButtonGroup>
            </div>

            <BioField defaultValue={profile.bio ?? ""} placeholder={t("bio_placeholder")} label={t("bio_label")} />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isSubmitting} size="lg" className="w-full sm:w-auto">
            {isSubmitting && <IconLoader2 className="mr-2 size-4 animate-spin" />}
            {isSubmitting ? t("saving") : t("save_changes")}
          </Button>
        </div>
      </Form>

      <div className="space-y-4 pt-6">
        <div>
          <h3 className="text-lg font-medium">{t("emails")}</h3>
          <p className="text-sm text-muted-foreground">{t("emails_desc")}</p>
        </div>
        <Separator />

        <div className="p-4 rounded-lg border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-medium">{t("primary_email")}</p>
            <p className="text-sm text-muted-foreground">{t("managed_by_provider")}</p>
          </div>
          <Button variant="outline" disabled size="lg" className="w-full sm:w-auto hover:cursor-not-allowed!">
            {t("manage")}
          </Button>
        </div>
      </div>
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
