import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import BackgroundDocs from "../components/BackgroundDocs";

const RESEND_COOLDOWN = 45;

export default function Verify() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const fromQueryEmail = params.get("email") || "";
  const mode = (params.get("mode") || "login2fa").toLowerCase();
  const storedEmail = typeof window !== "undefined" ? localStorage.getItem("pendingEmail") || "" : "";
  const email = (fromQueryEmail || storedEmail).trim();

  const [token, setToken] = useState("");
  const [status, setStatus] = useState({ loading: false, msg: "" });
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef(null);

  useEffect(() => { codeRef.current?.focus(); }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  if (!email) {
    return (
      <main className="min-h-screen grid place-items-center px-6">
        <BackgroundDocs />
        <div className="w-full max-w-md rounded-2xl border border-neutral-200/70 bg-white/80 backdrop-blur p-6 shadow">
          <h1 className="text-2xl font-semibold">We need your email</h1>
          <p className="mt-2 text-sm text-neutral-700">Go back and enter your email first.</p>
          <a href="/login" className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-white">
            Go to Login
          </a>
        </div>
      </main>
    );
  }

  async function handleVerify(e) {
    e.preventDefault();
    setStatus({ loading: true, msg: "" });
    if (!/^\d{6}$/.test(token)) {
      setStatus({ loading: false, msg: "Enter a valid 6-digit code." });
      return;
    }
    try {
      const otpType = mode.includes("signup") ? "signup" : "email";
      const { error } = await supabase.auth.verifyOtp({ email, token, type: otpType });
      if (error) throw error;

      localStorage.removeItem("pendingEmail");
      setStatus({ loading: false, msg: "Verified! Redirecting…" });
      setTimeout(() => (window.location.href = "/dashboard"), 500);
    } catch (err) {
      setStatus({ loading: false, msg: err?.message || "Verification failed" });
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setStatus({ loading: false, msg: "" });
    try {
      const shouldCreateUser = mode === "signup2fa";
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser },
      });
      if (error) throw error;
      setCooldown(RESEND_COOLDOWN);
      setStatus({ loading: false, msg: "New code sent. Check your email." });
    } catch (err) {
      setStatus({ loading: false, msg: err?.message || "Could not resend code" });
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <BackgroundDocs />
      <div className="w-full max-w-md rounded-2xl border border-neutral-200/70 bg-white/80 backdrop-blur p-6 shadow">
        <h1 className="text-2xl font-semibold text-neutral-900">Enter your code</h1>
        <form className="mt-6 space-y-4" onSubmit={handleVerify}>
          <div>
            <label className="block text-sm font-medium">6-digit code</label>
            <input
              ref={codeRef}
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              className="mt-1 w-full rounded-xl border px-3.5 py-2.5 tracking-widest text-center bg-white/90"
              placeholder="••••••"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
            <p className="mt-2 text-xs text-neutral-600">
              Didn’t get it?{" "}
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0}
                className={`${cooldown > 0 ? "text-neutral-400 cursor-not-allowed" : "text-blue-600 hover:underline"}`}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </p>
          </div>

          <button
            type="submit"
            disabled={status.loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-white font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {status.loading ? "Verifying…" : "Verify"}
          </button>

          {status.msg && <p className="text-sm text-red-600 mt-1">{status.msg}</p>}
        </form>
      </div>
    </main>
  );
}
