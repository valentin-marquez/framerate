import type { Database } from "@framerate/db";
import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { useFetcher } from "react-router";
import { requireRole } from "@/features/auth/services/auth.server";
import type { Route } from "./+types/review-dashboard";

// Helper to get supabase client (assuming shared utility or simple construction)
function getSupabase(request: Request) {
  const headers = new Headers();
  const supabase = createServerClient<Database>(process.env.SUPABASE_URL || "", process.env.SUPABASE_ANON_KEY || "", {
    cookies: {
      getAll() {
        const cookies = parseCookieHeader(request.headers.get("Cookie") ?? "");
        // Ensure value is string (it should be from parseCookieHeader but type definition might have optional)
        return cookies.map((c) => ({ name: c.name, value: c.value ?? "" }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          headers.append("Set-Cookie", serializeCookieHeader(name, value, options));
        }
      },
    },
  });
  return { supabase, headers };
}

export function meta(_: Route.MetaArgs) {
  return [{ title: "Gatekeeper | Framerate Admin" }, { name: "description", content: "Data Review Dashboard" }];
}

interface ScrapedData {
  title?: string;
  price?: number | string;
  source?: string;
  image?: string;
}

interface CandidateData {
  manufacturer?: string;
  model?: string;
  mpn?: string;
  [key: string]: unknown;
}

interface ReviewDashboardData {
  queueDepth: string;
  currentItem: {
    id: string;
    msgId: string;
    scraped: {
      title: string;
      price: number;
      retailer: string;
      image: string;
    };
    candidate: {
      id: string;
      manufacturer: string;
      model: string;
      mpn: string;
      specifications: CandidateData;
    };
    score: number;
    reasons: unknown[];
  } | null;
}

export async function loader({ request }: Route.LoaderArgs) {
  // Sólo moderadores y admins pueden ver el dashboard de gatekeeper.
  await requireRole(request, "moderator");

  const { supabase, headers } = getSupabase(request);

  // Call the robust RPC function we created
  const { data: item, error } = await supabase.rpc("get_next_review_item");

  if (error) {
    console.error("Error fetching review item:", error);
    // Fail gracefully, possibly specific error UI
    return Response.json({ queueDepth: "?", currentItem: null } as ReviewDashboardData, { headers });
  }

  if (!item || !item[0]) {
    // Queue empty
    return Response.json({ queueDepth: "0", currentItem: null } as ReviewDashboardData, { headers });
  }

  const result = item[0];
  const scraped = (result.scraped_data ?? {}) as ScrapedData;
  const candidate = (result.candidate_data ?? {}) as CandidateData;
  const reasons = Array.isArray(result.match_reasons) ? result.match_reasons : [];

  // Transform to UI format
  const currentItem = {
    id: result.raw_feed_id,
    msgId: String(result.msg_id),
    scraped: {
      title: scraped.title || "Unknown Title",
      price: Number(scraped.price) || 0,
      retailer: scraped.source || "Unknown Retailer",
      image: scraped.image || "",
    },
    candidate: {
      id: result.candidate_id,
      manufacturer: candidate.manufacturer || "",
      model: candidate.model || "Unknown Model",
      mpn: candidate.mpn || "",
      specifications: candidate,
    },
    score: result.match_score,
    reasons,
  };

  const queueDepth = "?";

  return Response.json({ queueDepth, currentItem } as ReviewDashboardData, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  // Reforzamos el chequeo en el action: un POST directo también debe pasar.
  await requireRole(request, "moderator");

  const { supabase, headers } = getSupabase(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const itemId = formData.get("itemId") as string;
  const msgId = formData.get("msgId") as string;

  if (!itemId || !msgId) {
    return Response.json({ success: false, error: "Missing ID" }, { headers });
  }

  let decision = "MATCH"; // Default
  if (intent === "reject") decision = "REJECT";

  const { error } = await supabase.rpc("resolve_review_item", {
    p_msg_id: Number(msgId),
    p_decision: decision,
    p_raw_feed_id: itemId,
  });

  if (error) {
    console.error("Error resolving item:", error);
    return Response.json({ success: false, error: error.message }, { headers });
  }

  return Response.json({ success: true }, { headers });
}

export default function ReviewDashboard({ loaderData }: Route.ComponentProps) {
  const { queueDepth, currentItem } = loaderData;
  const fetcher = useFetcher();

  if (!currentItem) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">All Caught Up! 🎉</h1>
        <p className="text-gray-600">The review queue is empty.</p>
        <div className="mt-8 bg-white px-4 py-2 rounded-lg shadow-sm border">
          <span className="text-gray-500 text-sm">Queue Depth:</span>
          <span className="ml-2 font-mono font-bold text-blue-600">0</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="mb-8 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Gatekeeper</h1>
        <div className="bg-white px-4 py-2 rounded-lg shadow-sm">
          <span className="text-gray-500 text-sm">Queue estimate:</span>
          <span className="ml-2 font-mono font-bold text-blue-600">{queueDepth}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
        {/* Scraped Item */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Incoming (Scraped)</h2>
          <div className="space-y-4">
            <div>
              <span className="text-xs text-gray-500">Title</span>
              <p className="text-lg font-medium text-gray-900">{currentItem.scraped.title}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <span className="text-xs text-gray-500">Retailer</span>
                <p className="font-mono text-sm">{currentItem.scraped.retailer}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Price</span>
                <p className="font-mono text-sm">${Number(currentItem.scraped.price).toLocaleString()}</p>
              </div>
            </div>
            {/* Visual Diff Placeholder */}
            <div className="p-4 bg-yellow-50 text-yellow-800 text-sm rounded-md border border-yellow-100">
              ⚠ Ambiguous Match (Score: {currentItem.score})
            </div>
          </div>
        </div>

        {/* Candidate Item */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 ring-2 ring-blue-500/10">
          <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-4">Suggested Match (OpenDB)</h2>
          <div className="space-y-4">
            <div>
              <span className="text-xs text-gray-500">Canonical Title</span>
              <p className="text-lg font-medium text-gray-900">{currentItem.candidate.model}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <span className="text-xs text-gray-500">MPN</span>
                <p className="font-mono text-sm">{currentItem.candidate.mpn}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Manufacturer</span>
                <p className="text-sm">{currentItem.candidate.manufacturer}</p>
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-500">Specs</span>
              <pre className="text-xs bg-gray-50 p-2 rounded border mt-1 overflow-x-auto">
                {JSON.stringify(currentItem.candidate.specifications, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-center gap-4 shadow-lg">
        <fetcher.Form method="post">
          <input type="hidden" name="itemId" value={currentItem.id} />
          <input type="hidden" name="msgId" value={String(currentItem.msgId)} />
          <button
            name="intent"
            value="reject"
            className="px-8 py-3 bg-red-50 text-red-600 font-medium rounded-lg hover:bg-red-100 transition-colors"
            type="submit"
            disabled={fetcher.state !== "idle"}
          >
            {fetcher.state !== "idle" ? "Processing..." : "Reject & Create New"}
          </button>
        </fetcher.Form>

        <fetcher.Form method="post">
          <input type="hidden" name="itemId" value={currentItem.id} />
          <input type="hidden" name="msgId" value={String(currentItem.msgId)} />
          <button
            name="intent"
            value="confirm"
            className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md transition-colors"
            type="submit"
            disabled={fetcher.state !== "idle"}
          >
            {fetcher.state !== "idle" ? "Processing..." : "Confirm Match (Space)"}
          </button>
        </fetcher.Form>
      </div>
    </div>
  );
}
