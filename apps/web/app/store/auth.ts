import type { SupabaseClient, User } from "@supabase/supabase-js";
import { create } from "zustand";
import type { Profile } from "~/services/profiles";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  supabase: SupabaseClient | null;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setSupabase: (client: SupabaseClient) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  supabase: null,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setSupabase: (supabase) => set({ supabase }),
}));
