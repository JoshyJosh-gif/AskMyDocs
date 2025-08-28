// supabase/functions/_shared/common.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const LIMITS: Record<string, number> = {
  summarize: 50,
  ask: 100,
};

// Build a supabase client bound to the incoming request's auth header
export function supaForReq(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });
}

// Get the authenticated user (via the request's access token)
export async function getAuthedUser(req: Request) {
  const supa = supaForReq(req);
  const { data: { user }, error } = await supa.auth.getUser();
  if (error || !user) return null;
  return { supa, user };
}

// Enforce per-kind daily limit and log usage if allowed
export async function checkAndLogUsage(req: Request, kind: keyof typeof LIMITS) {
  const ctx = await getAuthedUser(req);
  if (!ctx) {
    return { ok: false, res: json({ error: "Unauthorized" }, 401) };
  }
  const { supa, user } = ctx;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: cErr } = await supa
    .from("usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("kind", kind)
    .gte("created_at", since);

  if (cErr) return { ok: false, res: json({ error: cErr.message }, 500) };

  const limit = LIMITS[kind] ?? 0;
  if ((count ?? 0) >= limit) {
    return { ok: false, res: json({ error: "Daily limit reached", kind, limit }, 429) };
  }

  // allow → log usage (non-fatal if logging fails)
  const { error: iErr } = await supa
    .from("usage_events")
    .insert({ user_id: user.id, kind });
  if (iErr) console.warn("usage insert failed:", iErr);

  return { ok: true, supa, user };
}

// CORS + JSON helpers
export const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:5173";
export function withCORS(handler: (req: Request) => Promise<Response> | Response) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") {
      const reqHeaders = req.headers.get("Access-Control-Request-Headers") || "authorization, apikey, content-type";
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": reqHeaders,
          "Access-Control-Max-Age": "86400",
        },
      });
    }
    const res = await handler(req);
    const h = new Headers(res.headers);
    h.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    h.set("Vary", "Origin");
    return new Response(res.body, { status: res.status, headers: h });
  };
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
