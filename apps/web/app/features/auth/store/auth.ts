import type { Me } from "@framerate/contracts";
import { create } from "zustand";
import type { Profile } from "~/features/profile/services/profiles";

// Herencia de Supabase (sesión en el cliente). Hoy es un espejo del loader raíz que `App` llena en un efecto, así que
// en el SSR y el primer render está vacío: usar `useUser`/`useProfile` (`features/auth/hooks/useAuth`). Borrar cuando
// no queden lectores.
interface AuthState {
  user: Me | null;
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  setProfile: (profile) => set({ profile }),
}));
