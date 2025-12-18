import type { SupabaseClient, User } from "@supabase/supabase-js";
import { Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import type { Category } from "../utils/db-types";
import { CategoryDropdown } from "./category-dropdown";
import { LoginDropdown } from "./login-dropdown";
import { Logo } from "./logo";
import { UserDropdown } from "./user-dropdown";

interface NavbarProps {
  supabase: SupabaseClient;
  user: User | null;
  categories: Category[];
}

export function Navbar({ supabase, user, categories }: NavbarProps) {
  const [isLogoHovered, setIsLogoHovered] = useState(false);

  return (
    <nav className="bg-card backdrop-blur-md border-b border-border sticky top-0 z-40 py-2 ">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Left: Logo & Categories */}
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-2"
            onMouseEnter={() => setIsLogoHovered(true)}
            onMouseLeave={() => setIsLogoHovered(false)}
          >
            <Logo className="h-8 w-8 text-foreground" isHovered={isLogoHovered} />
            <span className="text-xl font-bold font-display tracking-tight">Framerate</span>
          </Link>

          <div className="hidden md:block">
            <CategoryDropdown categories={categories} />
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-xl mx-8 hidden md:block">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
            <input
              type="text"
              placeholder="Buscar productos, marcas y más..."
              className="w-full h-10 rounded-xl border border-border bg-muted/50 pl-10 pr-4 text-sm outline-none focus:bg-background focus:ring-2 focus:ring-ring/20 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
          </div>
        </div>

        {/* Right: Login Dropdown */}
        <div className="flex items-center gap-4">
          {user ? <UserDropdown supabase={supabase} user={user} /> : <LoginDropdown supabase={supabase} />}
        </div>
      </div>
    </nav>
  );
}
