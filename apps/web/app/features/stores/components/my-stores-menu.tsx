import { IconBuildingStore, IconLoader2 } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useAuthStore } from "~/features/auth/store/auth";
import { type MyStore, type MyStoreRole, profilesService } from "~/features/profile/services/profiles";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "~/shared/components/primitives/dropdown-menu";
import { StoreLogo } from "~/shared/components/store-logo";

const ROLE_LABEL: Record<MyStoreRole, string> = {
  owner: "Dueño",
  admin: "Admin",
  editor: "Editor",
};

async function getToken(): Promise<string | undefined> {
  const supabase = useAuthStore.getState().supabase;
  if (!supabase) return undefined;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? undefined;
}

interface MyStoresMenuProps {
  /** Si false, no monta la query (skip cuando el usuario no está logueado). */
  enabled: boolean;
}

/**
 * Sección "Mis tiendas" para el dropdown del avatar. Si el usuario no tiene
 * tiendas la sección entera se omite (devuelve null). Renderea un separador y
 * un grupo de items navegables a `/tiendas/:slug/admin` con el icono y el rol
 * del miembro como pista visual.
 *
 * El fetch se hace con TanStack Query, así que se cachea entre re-aperturas del
 * dropdown y se revalida en el background.
 */
export function MyStoresMenu({ enabled }: MyStoresMenuProps) {
  const query = useQuery({
    queryKey: ["profile", "me", "stores"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return { stores: [] as MyStore[] };
      return profilesService.listMyStores(token);
    },
    enabled,
    staleTime: 60_000,
  });

  const stores = query.data?.stores ?? [];

  // Loading inicial: mostramos un placeholder discreto para que el dropdown no
  // dé un salto cuando llega la respuesta.
  if (query.isLoading) {
    return (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2">
          <IconBuildingStore className="size-4" />
          <span>Mis tiendas</span>
          <IconLoader2 className="ml-auto size-3.5 animate-spin opacity-60" />
        </DropdownMenuLabel>
      </>
    );
  }

  if (stores.length === 0) return null;

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="flex items-center gap-2">
        <IconBuildingStore className="size-4" />
        <span>Mis tiendas</span>
      </DropdownMenuLabel>
      {stores.map((s) => (
        <DropdownMenuItem key={s.id}>
          <Link to={`/tiendas/${s.slug}/admin`} className="flex w-full items-center gap-2.5" prefetch="intent">
            <StoreLogo store={{ name: s.name, slug: s.slug, icon_url: s.icon_url }} className="size-6 rounded-md" />
            <span className="truncate">{s.name}</span>
            {s.role ? <span className="ml-auto text-xs text-muted-foreground/80">{ROLE_LABEL[s.role]}</span> : null}
          </Link>
        </DropdownMenuItem>
      ))}
    </>
  );
}
