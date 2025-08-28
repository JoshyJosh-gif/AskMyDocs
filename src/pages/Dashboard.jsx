// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";

// ---- pdf.js worker (Vite-friendly)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// ---- Config
const BUCKET = "docs";
const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const SUMMARIZE_URL = `${FUNCTIONS_URL}/summarize`;
const ASK_URL = `${FUNCTIONS_URL}/ask`;
const TRANSCRIBE_URL = `${FUNCTIONS_URL}/transcribe`;
const SHARE_URL = `${FUNCTIONS_URL}/share`;

const SUMMARY_DAILY_LIMIT = 50;
const QUESTION_DAILY_LIMIT = 100;

// ---- Utils
function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}
function human(bytes) {
  if (bytes == null || isNaN(bytes)) return "";
  const k = 1024, units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}
function guessType(name = "") {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpg|jpeg|gif|webp|bmp|tiff)$/.test(n)) return "image";
  if (/\.(mp3|m4a|wav|aac|ogg|flac)$/.test(n)) return "audio";
  return "file";
}
function safeName(n = "") {
  return n.replace(/[^\w.\-]+/g, "_");
}

async function getSignedUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

// ---- TEXT EXTRACTION
async function extractPdfTextFromUrl(url) {
  const pdf = await pdfjsLib.getDocument(url).promise;
  let text = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map((i) => i.str).join(" ") + "\n";
  }
  return text.trim();
}
async function extractImageTextFromDoc(doc) {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(doc.path);
    if (error) throw error;
    const { data: ocr } = await Tesseract.recognize(data, "eng", { tessedit_pageseg_mode: 6 });
    return (ocr?.text || "").trim();
  } catch {
    const url = doc.url || (await getSignedUrl(doc.path));
    const resp = await fetch(url);
    const blob = await resp.blob();
    const { data: ocr2 } = await Tesseract.recognize(blob, "eng", { tessedit_pageseg_mode: 6 });
    return (ocr2?.text || "").trim();
  }
}
async function transcribeAudioForDoc(doc) {
  const url = doc.url || (await getSignedUrl(doc.path));
  const res = await fetch(TRANSCRIBE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || data?.error || "Transcription failed");
  return (data?.text || "").trim();
}

export default function Dashboard() {
  const loc = useLocation();

  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // doc = { id,name,type,path,url,size,text?,summary?,updatedAt? }
  const [docs, setDocs] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const active = useMemo(() => docs.find((d) => d.id === activeId), [docs, activeId]);

  const [answersByDoc, setAnswersByDoc] = useState({}); // { [docId]: [{q,a,at}] }
  const [ask, setAsk] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Usage counters (last 24h)
  const [usage, setUsage] = useState({ summaries: 0, questions: 0 });

  // ---- Auth bootstrap
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setUser(u?.user || null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user || null));
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  // Close account dropdown on route change
  useEffect(() => setMenuOpen(false), [loc.pathname]);

  // ---- Load library + saved summaries + usage on login
  useEffect(() => {
    if (user?.id) {
      loadLibraryAndSummaries(user.id);
      refreshUsage(user.id);
    }
  }, [user?.id]);

  async function refreshUsage(userId) {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // summaries
      const { count: sCount, error: sErr } = await supabase
        .from("usage_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("kind", "summary")
        .gte("created_at", since);
      if (sErr) throw sErr;

      // questions
      const { count: qCount, error: qErr } = await supabase
        .from("usage_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("kind", "question")
        .gte("created_at", since);
      if (qErr) throw qErr;

      setUsage({ summaries: sCount || 0, questions: qCount || 0 });
    } catch (e) {
      // non-fatal
      console.warn("Usage fetch failed:", e?.message || e);
    }
  }

  async function logUsage(kind, type = "single") {
    try {
      if (!user?.id) return;
      await supabase.from("usage_events").insert({
        user_id: user.id,
        kind,
        type,
      });
      await refreshUsage(user.id);
    } catch (e) {
      console.warn("Usage insert failed:", e?.message || e);
    }
  }

  async function loadLibraryAndSummaries(userId) {
    setErr("");
    // 1) files
    const { data: files, error } = await supabase.storage
      .from(BUCKET)
      .list(userId, { limit: 1000, sortBy: { column: "updated_at", order: "desc" } });
    if (error) {
      setErr(error.message);
      return;
    }

    // 2) saved summaries
    const { data: meta, error: mErr } = await supabase
      .from("doc_meta")
      .select("path,last_summary,updated_at,name")
      .eq("user_id", userId);
    if (mErr) {
      setErr(mErr.message);
    }

    const metaMap = new Map((meta || []).map((m) => [m.path, m]));
    // 3) merge
    const mapped = await Promise.all(
      (files || []).map(async (f) => {
        const path = `${userId}/${f.name}`;
        const url = await getSignedUrl(path);
        const m = metaMap.get(path);
        return {
          id: path,
          name: f.name,
          type: guessType(f.name),
          path,
          url,
          size: f?.metadata?.size ? human(f.metadata.size) : "",
          text: undefined,
          summary: m?.last_summary || "—",
          updatedAt: new Date(f.updated_at || f.created_at || Date.now()).toLocaleString(),
        };
      })
    );

    setDocs(mapped);
    if (mapped[0]) {
      setActiveId(mapped[0].id);
      setSelectedIds([mapped[0].id]);
    }
  }

  // ---- Upload (auto-extract)
  async function handleUpload(e) {
    if (!user) {
      setErr("You must be logged in.");
      return;
    }
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      const type = guessType(file.name);
      const path = `${user.id}/${Date.now()}-${safeName(file.name)}`;
      const tempId = `${path}::temp`;

      // optimistic UI
      setDocs((prev) => [
        {
          id: tempId,
          name: file.name,
          type,
          path,
          size: human(file.size),
          summary: "—",
          updatedAt: "uploading…",
        },
        ...prev,
      ]);

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (upErr) {
        setDocs((prev) => prev.filter((d) => d.id !== tempId));
        setErr(upErr.message || "Upload failed");
        continue;
      }

      const url = await getSignedUrl(path);
      let text = "";
      try {
        if (type === "pdf") text = await extractPdfTextFromUrl(url);
        else if (type === "image") text = await extractImageTextFromDoc({ path, url, type });
        else if (type === "audio") text = await transcribeAudioForDoc({ path, url, type });
      } catch {
        // ignore extract errors; user can click Extract later
      }

      const finalized = {
        id: path,
        name: file.name,
        type,
        path,
        url,
        size: human(file.size),
        text,
        summary: "—",
        updatedAt: "just now",
      };
      setDocs((prev) => [finalized, ...prev.filter((d) => d.id !== tempId)]);
      setActiveId(path);
      setSelectedIds([path]);
    }

    e.target.value = "";
  }

  // ---- Lazy extract for selected doc
  async function ensureText(doc) {
    if (!doc || doc.text) return;
    try {
      const url = doc.url || (await getSignedUrl(doc.path));
      let text = "";
      if (doc.type === "pdf") text = await extractPdfTextFromUrl(url);
      else if (doc.type === "image") text = await extractImageTextFromDoc(doc);
      else if (doc.type === "audio") text = await transcribeAudioForDoc(doc);
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, text } : d)));
    } catch {
      setErr("Could not extract text for this file.");
    }
  }

  // ---- Save a summary row (per user + path)
  async function saveSummaryRow(doc, summary) {
    if (!user) return;
    await supabase.from("doc_meta").upsert({
      user_id: user.id,
      path: doc.path,
      name: doc.name,
      last_summary: summary,
      updated_at: new Date().toISOString(),
    });
  }

  // ---- Guards for limits
  function checkSummaryLimit(willUse = 1) {
    if (usage.summaries + willUse > SUMMARY_DAILY_LIMIT) {
      alert("Daily summary limit reached. Please try again tomorrow.");
      return false;
    }
    return true;
  }
  function checkQuestionLimit(willUse = 1) {
    if (usage.questions + willUse > QUESTION_DAILY_LIMIT) {
      alert("Daily question limit reached. Please try again tomorrow.");
      return false;
    }
    return true;
  }

  // ---- Summarize (single)
  async function summarizeDoc(doc) {
    if (!doc?.text) {
      setErr("No text extracted for this file yet.");
      return;
    }
    if (!FUNCTIONS_URL) {
      setErr("Missing VITE_FUNCTIONS_URL");
      return;
    }
    if (!checkSummaryLimit(1)) return;

    setBusy(true);
    try {
      const MAX_CHARS = 200_000;
      const res = await fetch(SUMMARIZE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ANON_KEY}`,
          apikey: ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: doc.text.slice(0, MAX_CHARS), name: doc.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || "Summarize failed");

      const summary = data.summary || "No summary.";
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, summary } : d)));
      await saveSummaryRow(doc, summary);

      // usage +
      await logUsage("summary", "single");
    } catch (ex) {
      setErr(ex.message || "Summarize failed");
    } finally {
      setBusy(false);
    }
  }

  // ---- Summarize (multiple)
  async function summarizeSelected() {
    const chosen = docs.filter((d) => selectedIds.includes(d.id) && d.text && d.text.length > 0);
    if (chosen.length === 0) {
      setErr("No selected docs with extracted text.");
      return;
    }
    if (!checkSummaryLimit(chosen.length)) return;

    setBusy(true);
    try {
      const MAX_CHARS = 200_000;
      for (const d of chosen) {
        const res = await fetch(SUMMARIZE_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ANON_KEY}`,
            apikey: ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: d.text.slice(0, MAX_CHARS), name: d.name }),
        });
        const data = await res.json();
        const summary = res.ok ? data.summary || "No summary." : "Summary unavailable.";
        setDocs((prev) => prev.map((x) => (x.id === d.id ? { ...x, summary } : x)));
        await saveSummaryRow(d, summary);
      }
      // usage +N
      await logUsage("summary", chosen.length > 1 ? "multi" : "single");
    } catch (ex) {
      setErr(ex.message || "Summarize selected failed");
    } finally {
      setBusy(false);
    }
  }

  // ---- Ask (per doc or selected)
  async function onAsk(e) {
    e.preventDefault();
    const q = ask.trim();
    if (!q) {
      setErr("Type a question first.");
      return;
    }
    if (!FUNCTIONS_URL) {
      setErr("Missing VITE_FUNCTIONS_URL");
      return;
    }

    const chosen = selectedIds.length ? docs.filter((d) => selectedIds.includes(d.id)) : active ? [active] : [];
    const targets = chosen.filter((d) => d.text && d.text.length > 0);
    if (targets.length === 0) {
      setErr("No parsed text. Extract first.");
      return;
    }
    if (!checkQuestionLimit(targets.length)) return;

    const MAX_CHARS = 200_000;
    setBusy(true);
    try {
      for (const d of targets) {
        const res = await fetch(ASK_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ANON_KEY}`,
            apikey: ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: q,
            docs: [{ name: d.name, text: (d.text || "").slice(0, MAX_CHARS) }],
          }),
        });
        const data = await res.json().catch(() => ({}));
        const answer = res.ok
          ? data.answer || "No answer."
          : `Ask failed: ${data?.error || data?.message || res.statusText || res.status}`;

        setAnswersByDoc((prev) => {
          const arr = prev[d.id] || [];
          return { ...prev, [d.id]: [{ q, a: answer, at: Date.now() }, ...arr] };
        });
      }
      setAsk("");

      // usage +N
      await logUsage("question", targets.length > 1 ? "multi" : "single");
    } catch (e2) {
      setErr(e2.message || "Ask failed");
    } finally {
      setBusy(false);
    }
  }

  // ---- Share summary (creates public HTML + copies URL)
  async function shareSummary(doc) {
    if (!doc?.summary || doc.summary === "—") {
      setErr("No summary to share yet.");
      return;
    }
    try {
      const res = await fetch(SHARE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" }, // server function uses service key
        body: JSON.stringify({ name: doc.name, summary: doc.summary }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Share failed");
      if (data?.url) {
        try {
          await navigator.clipboard.writeText(data.url);
        } catch {}
        alert(`Share link copied!\n\n${data.url}`);
      } else {
        setErr("Share failed: no URL returned.");
      }
    } catch (e) {
      setErr(e.message || "Share failed");
    }
  }

  const activeAnswers = answersByDoc[activeId] || [];

  return (
    <div className="min-h-screen bg-gray-50 text-black">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-black/5">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 py-3 flex items-center justify-between">
          {/* Left: logo (click -> home) */}
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo.png" className="h-9 w-auto object-contain" alt="logo" />
            <span className="font-semibold hidden sm:inline">Dashboard</span>
          </Link>

          {/* Middle: usage counters */}
          <div className="hidden sm:block text-sm text-gray-700">
            Summaries:{" "}
            <span className={usage.summaries >= SUMMARY_DAILY_LIMIT ? "text-red-600 font-semibold" : ""}>
              {usage.summaries}
            </span>
            /{SUMMARY_DAILY_LIMIT} · Questions:{" "}
            <span className={usage.questions >= QUESTION_DAILY_LIMIT ? "text-red-600 font-semibold" : ""}>
              {usage.questions}
            </span>
            /{QUESTION_DAILY_LIMIT}
          </div>

          {/* Right: account dropdown */}
          <div className="relative">
            {!user ? (
              <Link
                to="/login"
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
              >
                Login
              </Link>
            ) : (
              <>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 hover:text-blue-600"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen ? "true" : "false"}
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/5">
                    {user.email?.[0]?.toUpperCase() || "U"}
                  </span>
                  <span className="hidden sm:inline max-w-[180px] truncate text-sm">{user.email}</span>
                  <span aria-hidden>▾</span>
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-black/10 shadow"
                  >
                    <Link
                      to="/"
                      role="menuitem"
                      className="block px-4 py-2 hover:bg-black/[0.03]"
                      onClick={() => setMenuOpen(false)}
                    >
                      Home
                    </Link>
                    <button
                      role="menuitem"
                      className="w-full text-left px-4 py-2 hover:bg-black/[0.03]"
                      onClick={() => {
                        setMenuOpen(false);
                        alert("Manage subscription (coming soon)");
                      }}
                    >
                      Manage subscription
                    </button>
                    <button
                      role="menuitem"
                      className="w-full text-left px-4 py-2 hover:bg-black/[0.03]"
                      onClick={() => {
                        setMenuOpen(false);
                        alert("Account settings (coming soon)");
                      }}
                    >
                      Account settings
                    </button>
                    <button
                      role="menuitem"
                      className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50"
                      onClick={async () => {
                        setMenuOpen(false);
                        await supabase.auth.signOut();
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Error banner */}
      {err && (
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 pt-3">
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{err}</div>
        </div>
      )}

      {/* Main layout */}
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Library */}
        <aside className="lg:col-span-3">
          <div className="rounded-2xl bg-white border border-black/5 shadow h-[620px] flex flex-col">
            <div className="p-4 border-b border-black/5 flex items-center justify-between shrink-0">
              <div className="font-semibold">Your Library</div>
              <label className="px-3 py-1 rounded-lg text-sm bg-blue-600 text-white cursor-pointer hover:bg-blue-700">
                Upload
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleUpload}
                  accept=".pdf,image/*,audio/*"
                />
              </label>
            </div>
            <ul className="p-2 overflow-y-auto grow">
              {docs.length === 0 && (
                <li className="px-3 py-10 text-sm text-gray-500 text-center">
                  No files yet. Click <span className="font-medium">Upload</span> to add your first doc.
                </li>
              )}
              {docs.map((d) => (
                <li
                  key={d.id}
                  className={cx(
                    "flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer hover:bg-black/[0.03]",
                    activeId === d.id && "bg-blue-50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(d.id)}
                    onChange={() =>
                      setSelectedIds((prev) =>
                        prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                      )
                    }
                    className="h-4 w-4"
                  />
                  <button
                    onClick={async () => {
                      setActiveId(d.id);
                      if (!selectedIds.includes(d.id)) setSelectedIds([d.id]);
                      await ensureText(d);
                    }}
                    className="flex-1 text-left truncate"
                    title={d.name}
                  >
                    <div className="font-medium text-sm truncate">{d.name}</div>
                    <div className="text-xs text-gray-500">
                      {(d.size || d.type.toUpperCase())} · {d.updatedAt}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Preview */}
        <section className="lg:col-span-6">
          <div className="rounded-2xl bg-white border border-black/5 shadow overflow-hidden">
            <div className="p-4 border-b border-black/5 flex items-center justify-between">
              <div className="font-semibold truncate">
                {active?.name || "Select a document"}
                {active?.text != null && (
                  <span className="ml-3 text-xs text-gray-500">
                    {active.text.length.toLocaleString()} chars extracted
                  </span>
                )}
              </div>
              <div className="flex items-center">
                {active && !active.text && (active.type === "pdf" || active.type === "image" || active.type === "audio") && (
                  <button
                    onClick={() => ensureText(active)}
                    className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    disabled={busy}
                  >
                    {busy ? "Working…" : "Extract text"}
                  </button>
                )}
                {active?.text && selectedIds.length <= 1 && (
                  <button
                    onClick={() => summarizeDoc(active)}
                    className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 ml-2"
                    disabled={busy}
                  >
                    {busy ? "Working…" : "Summarize"}
                  </button>
                )}
                {selectedIds.length > 1 && docs.some((d) => selectedIds.includes(d.id) && d.text) && (
                  <button
                    onClick={summarizeSelected}
                    className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 ml-2"
                    disabled={busy}
                  >
                    {busy ? "Working…" : "Summarize Selected"}
                  </button>
                )}
              </div>
            </div>

            <div className="h-[420px] bg-gray-100 grid place-items-center">
              {!active && <div className="text-gray-500 text-sm">Choose a document from the left</div>}
              {active?.url && active.type === "pdf" && (
                <iframe title="pdf" src={active.url} className="w-full h-full" />
              )}
              {active?.url && active.type === "image" && (
                <img src={active.url} alt={active.name} className="max-h-full object-contain" />
              )}
              {active?.url && active.type === "audio" && (
                <audio controls className="w-11/12">
                  <source src={active.url} />
                </audio>
              )}
              {active && !active.url && <div className="text-gray-500 text-sm">Preview unavailable.</div>}
            </div>
          </div>
        </section>

        {/* Summary + Ask */}
        <section className="lg:col-span-3 space-y-6">
          <div className="rounded-2xl bg-white border border-black/5 shadow h-[300px] flex flex-col">
            <div className="p-4 border-b border-black/5 flex items-center justify-between shrink-0">
              <div className="font-semibold">AI Summary</div>
              {selectedIds.length <= 1 && active?.summary && active.summary !== "—" && (
                <button
                  onClick={() => shareSummary(active)}
                  className="text-xs px-3 py-1 rounded-lg bg-black text-white hover:bg-black/90 disabled:opacity-50"
                  disabled={busy}
                  title="Create a public link and copy it"
                >
                  Share summary
                </button>
              )}
            </div>
            <div className="p-4 text-sm text-gray-700 overflow-y-auto grow">
              {selectedIds.length > 1 ? (
                docs.filter((d) => selectedIds.includes(d.id)).length ? (
                  <ul className="list-disc ml-5 space-y-1 pr-2">
                    {docs
                      .filter((d) => selectedIds.includes(d.id))
                      .map((d) => (
                        <li key={d.id}>
                          <span className="font-medium">{d.name}:</span> {d.summary || "—"}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p>Select documents to view summaries.</p>
                )
              ) : (
                <p>
                  {active?.summary ||
                    (active?.text ? "Click Summarize to generate a summary." : "Upload or select a file; text is auto-extracted.")}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-black/5 shadow">
            <form onSubmit={onAsk} className="p-4 space-y-3">
              <label className="block text-sm font-semibold">
                Ask your docs {active?.name ? <span className="opacity-60">({active.name})</span> : null}
              </label>
              <textarea
                rows={3}
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                placeholder={selectedIds.length > 1 ? "Ask each selected doc…" : "Ask about this document…"}
                className="w-full rounded-xl border border-black/10 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={busy}
                className={cx(
                  "w-full py-2 rounded-xl text-white font-semibold",
                  busy ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {busy ? "Working…" : selectedIds.length > 1 ? "Ask Selected Docs" : "Ask"}
              </button>
            </form>
          </div>

          {active && (
            <div className="rounded-2xl bg-white border border-black/5 shadow h-[300px] flex flex-col">
              <div className="p-4 border-b border-black/5 font-semibold shrink-0">
                Answers for <span className="opacity-70">{active?.name}</span>
              </div>
              <ul className="p-4 space-y-3 text-sm overflow-y-auto grow">
                {(activeAnswers || []).length === 0 && (
                  <li className="text-gray-500">No answers yet. Ask a question above.</li>
                )}
                {(activeAnswers || []).map((x, i) => (
                  <li key={i} className="rounded-lg border border-black/5 p-3">
                    <p className="font-medium">Q: {x.q}</p>
                    <p className="text-gray-700 mt-1 whitespace-pre-wrap">A: {x.a}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
