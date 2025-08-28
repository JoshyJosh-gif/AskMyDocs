import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); // we still create a password for the account
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
      // 1) Create the user (password stored; email confirmation/magic link may also be sent)
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signUpErr) throw signUpErr;

      // 2) Send a 6-digit **email OTP code** (the “code system” you want)
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (otpErr) {
        // Supabase enforces ~60s cooldown; surface the message if hit.
        throw otpErr;
      }

      setMsg("We sent you a 6-digit code. Check your email.");
      // 3) Go to verify page to enter the code
      navigate(`/verify?mode=signup&email=${encodeURIComponent(email)}`);
    } catch (e) {
      setErr(e.message || "Registration failed");
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
        <h1 className="text-3xl font-semibold">Create your account</h1>
        <p className="text-sm text-gray-600 mt-1">
          Use your email and a password. We’ll send a 6-digit code to verify.
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
              placeholder="Create a strong password"
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
            {busy ? "Working…" : "Create account"}
          </button>
        </form>

        <div className="mt-4 text-sm text-gray-700">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
