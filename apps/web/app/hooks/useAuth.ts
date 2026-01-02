import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect } from "react";
import { useRevalidator } from "react-router";
import { useAuthStore } from "@/store/auth";

export function useAuth() {
  return useAuthStore();
}

export function useUser() {
  return useAuthStore((state) => state.user);
}

export function useSupabase() {
  return useAuthStore((state) => state.supabase);
}

/**
 * Hook para revalidar automáticamente cuando cambia la sesión
 * Úsalo en el componente root o en componentes que necesiten
 * actualizarse cuando el usuario hace login/logout
 */
export function useAuthSync(supabaseClient?: SupabaseClient) {
  const supabaseFromHook = useSupabase();
  const client = supabaseClient ?? supabaseFromHook;
  const { revalidate } = useRevalidator();

  useEffect(() => {
    if (!client) return;

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      // Revalidar cuando hay cambios en la autenticación
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        revalidate();
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [client, revalidate]);
}
