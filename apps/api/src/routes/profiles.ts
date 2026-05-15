import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { createSupabase } from "@/lib/supabase";
import { authMiddleware } from "@/middleware/auth";
import { CACHE_TTL, Cache } from "@/middleware/cache";
import { Limit } from "@/middleware/rate-limit";

const profiles = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Rutas protegidas
profiles.use("/me", authMiddleware);

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
