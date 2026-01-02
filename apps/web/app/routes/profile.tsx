import { useUser } from "@/hooks/useAuth";
import { requireAuth } from "@/lib/auth.server";
import type { Route } from "./+types/profile";

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireAuth(request);

  return { user };
}

export default function Profile({ loaderData }: Route.ComponentProps) {
  const user = useUser();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Mi Perfil</h1>

      <div className="bg-card rounded-lg border border-border p-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium text-muted-foreground">
              Email
            </label>
            <p id="email" className="text-lg">
              {user?.email}
            </p>
          </div>

          <div>
            <label htmlFor="user-id" className="text-sm font-medium text-muted-foreground">
              ID de Usuario
            </label>
            <p id="user-id" className="text-sm font-mono">
              {user?.id}
            </p>
          </div>

          <div>
            <label htmlFor="last-session" className="text-sm font-medium text-muted-foreground">
              Última Sesión
            </label>
            <p id="last-session" className="text-sm">
              {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("es-CL") : "N/A"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
