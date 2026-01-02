import type { SupabaseClient, User } from "@supabase/supabase-js";
import { create } from "zustand";

interface AuthState {
  user: User | null;
  supabase: SupabaseClient | null;
  setUser: (user: User | null) => void;
  setSupabase: (client: SupabaseClient) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  supabase: null,
  setUser: (user) => set({ user }),
  setSupabase: (supabase) => set({ supabase }),
}));
