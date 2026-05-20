import { storeAssetUrlFromPath } from "@framerate/db";
import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { createSupabase } from "@/lib/supabase";
import { authMiddleware } from "@/middleware/auth";
import { CACHE_TTL, Cache } from "@/middleware/cache";
import { Limit } from "@/middleware/rate-limit";

const profiles = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Rutas protegidas
profiles.use("/me", authMiddleware);
profiles.use("/me/*", authMiddleware);

/**
 * GET /v1/profiles/me
 *
 * Obtiene el perfil del usuario autenticado.
 */
profiles.get(
  "/me",
  Cache({ mode: "private", ttl: CACHE_TTL.SHORT, name: "profiles-me" }),
  Limit("moderate"),
  async (c) => {
    try {
      const user = c.get("user");
      const supabase = createSupabase(c.env, c.get("token"));

      const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();

      if (error) {
        // If profile doesn't exist, try to create it from auth metadata
        if (error.code === "PGRST116") {
          console.log("Profile not found, creating one for user:", user.id);

          const metadata = user.user_metadata || {};
          const username = metadata.username || metadata.preferred_username || user.email?.split("@")[0] || "user";
          const fullName =
            metadata.full_name ||
            metadata.name ||
            (metadata.first_name ? `${metadata.first_name} ${metadata.last_name || ""}`.trim() : null);
          const avatarUrl = metadata.avatar_url || metadata.picture;

          const { data: newProfile, error: createError } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              username,
              full_name: fullName,
              avatar_url: avatarUrl,
            })
            .select()
            .single();

          if (createError) {
            console.error("Error creating profile on the fly:", createError);
            return c.json({ error: "Failed to create profile" }, 500);
          }

          return c.json(newProfile);
        }

        console.error("Error fetching my profile:", error);
        return c.json({ error: "Failed to fetch profile" }, 500);
      }

      return c.json(profile);
    } catch (error) {
      console.error("Error fetching my profile:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  },
);

/**
 * PATCH /v1/profiles/me
 *
 * Actualiza el perfil del usuario autenticado.
 */
profiles.patch("/me", Limit("moderate"), async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json<{
      username?: string;
      full_name?: string;
      avatar_url?: string;
      lang?: string;
      bio?: string | null;
    }>();

    const supabase = createSupabase(c.env, c.get("token"));

    const updates: {
      updated_at: string;
      lang?: string;
      username?: string;
      full_name?: string;
      avatar_url?: string;
      bio?: string | null;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (body.lang !== undefined) {
      if (["es", "en", "arn"].includes(body.lang)) {
        updates.lang = body.lang;
      } else {
        return c.json({ error: "Invalid language" }, 400);
      }
    }

    if (body.username !== undefined) {
      const username = body.username.trim();
      if (username.length < 3) {
        return c.json({ error: "El nombre de usuario debe tener al menos 3 caracteres" }, 400);
      }
      // Check uniqueness if changed
      if (username !== user.user_metadata?.username) {
        // This check is weak, better let DB constraint fail
        // But we can check if it exists to give better error
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username)
          .neq("id", user.id)
          .single();

        if (existing) {
          return c.json({ error: "Username already taken" }, 409);
        }
      }
      updates.username = username;
    }

    if (body.full_name !== undefined) {
      updates.full_name = body.full_name.trim();
    }

    if (body.avatar_url !== undefined) {
      updates.avatar_url = body.avatar_url;
    }

    if (body.bio !== undefined) {
      if (body.bio === null || body.bio === "") {
        updates.bio = null;
      } else {
        const bio = body.bio.trim();
        if (bio.length > 280) {
          return c.json({ error: "Bio must be 280 characters or fewer" }, 400);
        }
        updates.bio = bio.length === 0 ? null : bio;
      }
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating profile:", error);
      return c.json({ error: "Failed to update profile" }, 500);
    }

    return c.json(profile);
  } catch (error) {
    console.error("Error updating profile:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /v1/profiles/me/stores
 *
 * Lista las tiendas donde el usuario autenticado es miembro de la account dueña.
 * Devuelve `{ stores: [{ id, slug, name, icon_url, role }] }` ordenado por nombre.
 * Si no tiene tiendas devuelve `{ stores: [] }`.
 */
profiles.get("/me/stores", Limit("moderate"), async (c) => {
  try {
    const user = c.get("user");
    const token = c.get("token");
    const supabase = createSupabase(c.env, token);
    const supabaseUrl = (c.env.SUPABASE_URL || Bun.env.SUPABASE_URL || "").replace(/\/$/, "");

    // 1) accounts donde el user es miembro + su rol.
    // biome-ignore lint/suspicious/noExplicitAny: types regen
    const { data: memberships, error: mErr } = await (supabase as any)
      .from("account_members")
      .select("account_id, role")
      .eq("user_id", user.id);

    if (mErr) {
      console.error("Error listing my account memberships:", mErr);
      return c.json({ error: "No se pudieron listar las tiendas" }, 500);
    }

    if (!memberships || memberships.length === 0) {
      return c.json({ stores: [] });
    }

    const accountIds = memberships.map((m: { account_id: string }) => m.account_id);
    const roleByAccount = new Map<string, "owner" | "admin" | "editor">(
      memberships.map((m: { account_id: string; role: "owner" | "admin" | "editor" }) => [m.account_id, m.role]),
    );

    // 2) Stores de esas accounts + override del icono en store_profiles.
    // biome-ignore lint/suspicious/noExplicitAny: types regen
    const { data: storesData, error: sErr } = await (supabase as any)
      .from("stores")
      .select("id, slug, name, account_id, scraped_icon_path, profile:store_profiles(icon_path)")
      .in("account_id", accountIds)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (sErr) {
      console.error("Error listing my stores:", sErr);
      return c.json({ error: "No se pudieron listar las tiendas" }, 500);
    }

    const list = (storesData ?? []).map(
      (s: {
        id: string;
        slug: string;
        name: string;
        account_id: string;
        scraped_icon_path: string | null;
        profile?: { icon_path: string | null } | { icon_path: string | null }[] | null;
      }) => {
        const profile = Array.isArray(s.profile) ? (s.profile[0] ?? null) : (s.profile ?? null);
        const iconPath = profile?.icon_path ?? s.scraped_icon_path;
        return {
          id: s.id,
          slug: s.slug,
          name: s.name,
          icon_url: storeAssetUrlFromPath(supabaseUrl, iconPath),
          role: roleByAccount.get(s.account_id) ?? null,
        };
      },
    );

    return c.json({ stores: list });
  } catch (error) {
    console.error("Error fetching my stores:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /v1/profiles/:username
 *
 * Obtiene el perfil público de un usuario.
 */
profiles.get("/:username", Limit("lenient"), async (c) => {
  try {
    const username = c.req.param("username");
    const supabase = createSupabase(c.env);

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, bio, created_at")
      .eq("username", username)
      .single();

    if (error || !profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    return c.json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default profiles;
