import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!email || !password) return setErr("Enter email and password.");

    setBusy(true);
    try {
      // 1) Validate password (so only the real owner can trigger OTP).
      const { error: passErr } = await supabase.auth.signInWithPassword({ email, password });
      if (passErr) throw passErr;

      // 2) (Optional hardening) Immediately sign out so we force OTP to complete the login.
      await supabase.auth.signOut();

      // 3) Send a 6-digit OTP code to the email
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (otpErr) throw otpErr;

      setMsg("We sent you a 6-digit code. Check your email.");
      // 4) Go to verify page
      navigate(`/verify?mode=login&email=${encodeURIComponent(email)}`);
    } catch (e) {
      setErr(e.message || "Login failed");
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
        <h1 className="text-3xl font-semibold">Log in</h1>
        <p className="text-sm text-gray-600 mt-1">
          Enter your email and password. We’ll send a 6-digit code to finish signing in.
        </p>

        {err && <div className="mt-3 rounded-md bg-red-50 text-red-700 text-sm p-3">{err}</div>}
        {msg && <div className="mt-3 rounded-md bg-blue-50 text-blue-700 text-sm p-3">{msg}</div>}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
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
            {busy ? "Working…" : "Send code"}
          </button>
        </form>

        <div className="mt-4 text-sm text-gray-700 flex items-center justify-between">
          <Link to="/reset" className="text-blue-600 hover:underline">
            Forgot password?
          </Link>
          <div>
            New here?{" "}
            <Link to="/register" className="text-blue-600 hover:underline">
              Create account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
