import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:5173";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

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

  const { url } = await req.json().catch(() => ({}));
  if (!url) return new Response(JSON.stringify({ error: "Missing 'url'" }), { status: 400 });
  if (!OPENAI_API_KEY) return new Response(JSON.stringify({ error: "Server missing OPENAI_API_KEY" }), { status: 500 });

  // Fetch the file from storage (signed URL you generated)
  const audio = await fetch(url);
  if (!audio.ok) {
    return new Response(JSON.stringify({ error: "Could not download audio" }), { status: 400 });
  }
  const blob = await audio.blob();

  const form = new FormData();
  form.append("file", blob, "audio.m4a");
  form.append("model", "gpt-4o-mini-transcribe"); // Whisper-quality, low cost

  const aiRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });

  if (!aiRes.ok) {
    const errTxt = await aiRes.text();
    return new Response(JSON.stringify({ error: "OpenAI error", detail: errTxt }), { status: 502 });
  }
  const j = await aiRes.json();
  return new Response(JSON.stringify({ text: j?.text ?? "" }), { status: 200 });
}));
