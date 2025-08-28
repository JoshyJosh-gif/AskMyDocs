import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Verify() {
  const navigate = useNavigate();
  const loc = useLocation();

  const params = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const mode = (params.get("mode") || "login").toLowerCase(); // "signup" or "login"
  const email = params.get("email") || "";

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setErr("");
    setMsg("");
  }, [email, mode]);

  async function onVerify(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!email) return setErr("Missing email.");
    if (!code || code.length < 6) return setErr("Enter the 6-digit code.");

    setBusy(true);
    try {
      // For email OTP, Supabase type is always "email"
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (error) throw error;

      // Success → go to dashboard
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setErr(e.message || "Invalid or expired code.");
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    setErr("");
    setMsg("");
    if (!email) return setErr("Missing email.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) {
        // You’ll see a 60-second cooldown error here if called too fast.
        throw error;
      }
      setMsg("A new code was sent to your email.");
    } catch (e) {
      setErr(e.message || "Could not resend yet. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-white overflow-hidden">
      {/* background image like Landing */}
      <img
        src="/docs-hero.png"
        alt=""
        className="pointer-events-none select-none absolute -right-10 bottom-0 w-[580px] max-w-[45vw] opacity-20"
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-black/5 bg-white/80 backdrop-blur shadow-lg p-6">
        <h1 className="text-3xl font-semibold">Verify your email</h1>
        <p className="text-sm text-gray-600 mt-1">
          We sent a 6-digit code to <span className="font-medium">{email || "your email"}</span>.
        </p>

        {err && <div className="mt-3 rounded-md bg-red-50 text-red-700 text-sm p-3">{err}</div>}
        {msg && <div className="mt-3 rounded-md bg-blue-50 text-blue-700 text-sm p-3">{msg}</div>}

        <form onSubmit={onVerify} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium">6-digit code</label>
            <input
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              className="mt-1 w-full tracking-widest text-center text-xl rounded-lg border border-black/10 px-3 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D+/g, ""))}
              placeholder="••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className={`w-full rounded-lg py-2 font-semibold text-white ${
              busy ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {busy ? "Verifying…" : "Verify & continue"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            onClick={onResend}
            disabled={busy}
            className="text-blue-600 hover:underline disabled:opacity-60"
          >
            Resend code
          </button>
          <Link to="/login" className="text-gray-600 hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
