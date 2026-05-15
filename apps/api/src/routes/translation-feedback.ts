import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { createSupabase } from "@/lib/supabase";
import { Limit } from "@/middleware/rate-limit";

const SUPPORTED_LANGS = ["es", "en", "arn"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

interface FeedbackBody {
  lang?: string;
  translation_key?: string;
  current_text?: string;
  suggested_text?: string;
  comment?: string | null;
  context_url?: string | null;
}

function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (SUPPORTED_LANGS as readonly string[]).includes(value);
}

function trimOrNull(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

const translationFeedback = new Hono<{ Bindings: Bindings; Variables: Variables }>();

translationFeedback.post("/", Limit("strict"), async (c) => {
  let body: FeedbackBody;
  try {
    body = await c.req.json<FeedbackBody>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!isLang(body.lang)) {
    return c.json({ error: "Invalid lang" }, 400);
  }

  const translationKey = trimOrNull(body.translation_key, 200);
  const currentText = trimOrNull(body.current_text, 2000);
  const suggestedText = trimOrNull(body.suggested_text, 2000);
  const comment = trimOrNull(body.comment, 2000);
  const contextUrl = trimOrNull(body.context_url, 1000);

  if (!translationKey || !currentText || !suggestedText) {
    return c.json({ error: "translation_key, current_text and suggested_text are required" }, 400);
  }

  if (suggestedText === currentText) {
    return c.json({ error: "Suggested text must differ from current text" }, 400);
  }

  // Optional auth: if a token is present, attach the user. RLS allows both
  // anon and authenticated inserts.
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
  const supabase = createSupabase(c.env, token);

  let userId: string | null = null;
  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error) userId = data.user?.id ?? null;
  }

  const userAgent = c.req.header("User-Agent")?.slice(0, 500) ?? null;

  const { error } = await supabase.from("translation_feedback").insert({
    lang: body.lang,
    translation_key: translationKey,
    current_text: currentText,
    suggested_text: suggestedText,
    comment,
    context_url: contextUrl,
    user_agent: userAgent,
    user_id: userId,
  });

  if (error) {
    console.error("Error inserting translation feedback:", error);
    return c.json({ error: "Failed to save feedback" }, 500);
  }

  return c.json({ result: "ok" }, 201);
});

export default translationFeedback;
