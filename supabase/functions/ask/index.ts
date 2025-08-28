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

function extractText(j: any): string {
  const a =
    j?.output_text ??
    j?.choices?.[0]?.message?.content ??
    (Array.isArray(j?.output)
      ? j.output
          .flatMap((o: any) => o?.content ?? [])
          .map((c: any) => c?.text ?? c?.content ?? "")
          .join("\n")
      : "");
  return (typeof a === "string" ? a.trim() : "") || "";
}

serve(withCORS(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let payload: any = {};
  try { payload = await req.json(); } catch {}
  const { question, docs } = payload || {};
  if (!question || !Array.isArray(docs) || docs.length === 0) {
    return new Response(JSON.stringify({ error: "Missing 'question' or 'docs'" }), { status: 400 });
  }
  if (!OPENAI_API_KEY) return new Response(JSON.stringify({ error: "Server missing OPENAI_API_KEY" }), { status: 500 });

  // Build a grounded prompt
  const MAX_DOCS = 10;
  const MAX_CHARS = 200_000;
  const corpus = docs.slice(0, MAX_DOCS).map((d: any, i: number) => {
    const nm = (d?.name ?? `Doc ${i + 1}`).toString();
    const tx = (d?.text ?? "").toString().slice(0, Math.floor(MAX_CHARS / Math.min(MAX_DOCS, docs.length)));
    return `### ${nm}\n${tx}`;
  }).join("\n\n");

  const prompt =
`You are a helpful assistant. Answer the user's question **using only** the provided documents.
If the answer is not present in the documents, say **"I couldn't find that in the provided documents."**.
When possible, name the document you used.

Documents:
${corpus}

Question: ${question}

Answer:`;

  const aiRes = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: prompt,
      max_output_tokens: 500,
      temperature: 0.2
    }),
  });

  if (!aiRes.ok) {
    const errTxt = await aiRes.text();
    return new Response(JSON.stringify({ error: "OpenAI error", detail: errTxt }), { status: 502 });
  }
  const j = await aiRes.json();
  const answer = extractText(j) || "No answer generated.";
  return new Response(JSON.stringify({ answer }), { status: 200 });
}));
