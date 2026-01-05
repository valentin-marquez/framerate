import { IconLoader2 } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { Form, useNavigation } from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/primitives/button";
import { ButtonGroup, ButtonGroupText } from "~/components/primitives/button-group";
import { Input } from "~/components/primitives/input";
import { InputGroup, InputGroupInput } from "~/components/primitives/input-group";
import { Label } from "~/components/primitives/label";
import { Separator } from "~/components/primitives/separator";
import { ApiError } from "~/lib/api";
import { requireAuth } from "~/lib/auth.server";
import { profilesService } from "~/services/profiles";
import { useAuthStore } from "~/store/auth";
import type { Route } from "./+types/account";

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = await requireAuth(request);
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
  // const bio = formData.get("bio") as string; // Not supported in DB yet

  try {
    const updatedProfile = await profilesService.updateMe(
      {
        full_name: fullName,
        username: username,
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

  // Mostrar toast de loading cuando se está enviando
  useEffect(() => {
    if (isSubmitting && !toastIdRef.current) {
      toastIdRef.current = toast.loading("Guardando cambios...");
    }
  }, [isSubmitting]);

  // Actualizar toast a success/error cuando se recibe la respuesta
  useEffect(() => {
    if (toastIdRef.current && !isSubmitting) {
      if (actionData?.success) {
        toast.success("Perfil actualizado correctamente", {
          id: toastIdRef.current,
        });

        // Actualizar el store con los nuevos datos del loader
        setProfile(actionData.profile || profile);
        toastIdRef.current = null;
      } else if (actionData?.error) {
        toast.error(actionData.error, {
          id: toastIdRef.current,
        });
        toastIdRef.current = null;
      }
    }
  }, [actionData, isSubmitting, profile, setProfile]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Tu perfil</h2>
        <p className="text-sm text-muted-foreground">Elige cómo apareces como anfitrión o invitado.</p>
      </div>

      <Separator />

      <Form method="post" className="space-y-8">
        <div className="flex flex-col md:flex-row-reverse gap-8">
          <div className="flex-1 space-y-4 w-full">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input
                id="fullName"
                name="fullName"
                defaultValue={profile.full_name || ""}
                placeholder="Tu nombre"
                className="h-10"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="username">Nombre de usuario</Label>
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

            <div className="grid gap-2 opacity-50 pointer-events-none">
              <Label htmlFor="bio">Biografía (Próximamente)</Label>
              <Input
                id="bio"
                name="bio"
                placeholder="Comparte un poco sobre tu experiencia e intereses."
                disabled
                className="h-10"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isSubmitting} size="lg" className="w-full sm:w-auto">
            {isSubmitting && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </Form>

      <div className="space-y-4 pt-6">
        <div>
          <h3 className="text-lg font-medium">Correos</h3>
          <p className="text-sm text-muted-foreground">Gestiona tus direcciones de correo electrónico.</p>
        </div>
        <Separator />

        <div className="p-4 rounded-lg border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-medium">Email principal</p>
            <p className="text-sm text-muted-foreground">Gestionado por el proveedor de autenticación</p>
          </div>
          <Button variant="outline" disabled size="lg" className="w-full sm:w-auto hover:cursor-not-allowed!">
            Gestionar
          </Button>
        </div>
      </div>
    </div>
  );
}
