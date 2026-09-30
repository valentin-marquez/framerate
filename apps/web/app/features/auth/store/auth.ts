import type { Me } from "@framerate/contracts";
import { create } from "zustand";
import type { Profile } from "~/features/profile/services/profiles";

interface AuthState {
  user: Me | null;
  profile: Profile | null;
  setUser: (user: Me | null) => void;
  setProfile: (profile: Profile | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
}));
