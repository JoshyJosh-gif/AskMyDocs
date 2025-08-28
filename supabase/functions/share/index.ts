import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:5173";
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const BUCKET = "shares"; // make sure this bucket exists and is public

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.warn("Missing SUPABASE_URL or SERVICE_ROLE_KEY in 'share' function");
}
const admin = (SUPABASE_URL && SERVICE_ROLE_KEY) ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

function withCORS(handler: (req: Request) => Promise<Response> | Response) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": ORIGIN,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
    const res = await handler(req);
    const h = new Headers(res.headers);
    h.set("Access-Control-Allow-Origin", ORIGIN);
    h.set("Vary", "Origin");
    h.set("Content-Type", "application/json");
    return new Response(res.body, { status: res.status, headers: h });
  };
}

serve(withCORS(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }
  if (!admin) {
    return new Response(JSON.stringify({ error: "Share function not configured" }), { status: 500 });
  }

  const { name, summary } = await req.json().catch(() => ({}));
  if (!name || !summary) {
    return new Response(JSON.stringify({ error: "Missing name or summary" }), { status: 400 });
  }

  // very light HTML (sanitized-ish)
  const safeName = String(name).replace(/[<>&]/g, "");
  const safeSummary = String(summary).replace(/</g, "&lt;");
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${safeName} — Summary</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;margin:2rem;line-height:1.6}
h1{font-size:1.4rem;margin:0 0 1rem}
pre{white-space:pre-wrap;background:#f6f8fa;border:1px solid #e5e7eb;padding:1rem;border-radius:12px}
footer{margin-top:2rem;color:#6b7280;font-size:.85rem}
</style>
</head>
<body>
  <h1>${safeName} — Summary</h1>
  <pre>${safeSummary}</pre>
  <footer>Shared via AskMyDocs</footer>
</body>
</html>`;

  const key = `${Date.now()}-${safeName.replace(/[^\w.-]+/g, "_")}.html`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(
    key,
    new Blob([html], { type: "text/html" }),
    { upsert: true }
  );
  if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500 });

  const { data } = admin.storage.from(BUCKET).getPublicUrl(key);
  return new Response(JSON.stringify({ url: data.publicUrl }), { status: 200 });
}));
