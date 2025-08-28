// src/pages/Verify.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

const typeForMode = (mode) => {
  switch ((mode || "").toLowerCase()) {
    case "signup": return "signup";  // <- IMPORTANT for register codes
    case "login":  return "email";   // <- IMPORTANT for login codes
    case "recovery": return "recovery";
    default: return "email";
  }
};

export default function Verify() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get("mode") || "login";
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const email = useMemo(() => sessionStorage.getItem("amd-verify-email") || "", []);

  // If the user clicked the email link (magic/confirm) already,
  // Supabase will often auto-complete a session on redirect.
  // Detect that and skip OTP entirely.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      // If there is a session, we’re done.
      if (mounted && data?.session) {
        nav("/dashboard", { replace: true });
      }
    })();
    return () => { mounted = false; };
  }, [nav]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (!email) throw new Error("We need your email (start from login/register again).");

      const otpType = typeForMode(mode); // 'signup' vs 'email'
      const { error, data } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: otpType,
      });
      if (error) throw error;

      // If verifyOtp didn’t open a session (rare), try to fetch it once more.
      const { data: s } = await supabase.auth.getSession();
      if (!s?.session) {
        // Some email flows confirm the user but don’t log in; fall back to signInWithPassword page.
        // (You can also silently sign the user in here if you kept their password.)
        throw new Error("Code accepted, but session not started. Please log in.");
      }

      // Clean up and go
      sessionStorage.removeItem("amd-verify-email");
      nav("/dashboard", { replace: true });
    } catch (ex) {
      setErr(ex.message || "Invalid or expired code.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setErr("");
    setBusy(true);
    try {
      if (!email) throw new Error("We need your email (start from login/register again).");
      const resendType = mode === "signup" ? "signup" : "email";
      const { error } = await supabase.auth.resend({ type: resendType, email });
      if (error) throw error;
      alert("A new code has been sent.");
    } catch (ex) {
      setErr(ex.message || "Could not resend code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-3xl font-bold mb-2">Enter the 6-digit code</h1>
      <p className="text-gray-600 mb-6">
        We sent a code to <span className="font-medium">{email || "your email"}</span>.
        {mode === "signup" && " (If you clicked the confirmation link already, you won’t need the code.)"}
      </p>

      {err && <div className="mb-4 text-red-600">{err}</div>}

      <form onSubmit={submit} className="space-y-4">
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          required
          value={code}
          onChange={(e)=>setCode(e.target.value.replace(/\D+/g,""))}
          placeholder="123456"
          className="w-full border rounded px-3 py-2 tracking-widest text-center text-lg"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
        >
          {busy ? "Verifying…" : "Verify"}
        </button>
      </form>

      <div className="flex items-center justify-between mt-4 text-sm">
        <button onClick={resend} disabled={busy} className="text-blue-600 hover:underline">
          Resend code
        </button>
        <Link to="/login" className="text-gray-600 hover:underline">
          Use a different account
        </Link>
      </div>
    </main>
  );
}
