import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import BackgroundDocs from "../components/BackgroundDocs";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [offerOtpFallback, setOfferOtpFallback] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setOfferOtpFallback(false);
    setLoading(true);

    try {
      const { error: pwErr } = await supabase.auth.signInWithPassword({ email, password });
      if (pwErr) {
        setMsg(pwErr.message || "Login failed");
        if (/invalid login credentials/i.test(pwErr.message || "")) {
          setOfferOtpFallback(true);
        }
        return;
      }
      await supabase.auth.signOut(); // enforce 2nd factor

      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (otpErr) throw otpErr;

      localStorage.setItem("pendingEmail", email);
      navigate(`/verify?email=${encodeURIComponent(email)}&mode=login2fa`);
    } catch (err) {
      setMsg(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function loginWithCodeOnly() {
    setMsg("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      localStorage.setItem("pendingEmail", email);
      navigate(`/verify?email=${encodeURIComponent(email)}&mode=login2fa`);
    } catch (err) {
      setMsg(err.message || "Could not send code");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setMsg("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset`,
      });
      if (error) throw error;
      setMsg("Password reset link sent. Check your email.");
    } catch (err) {
      setMsg(err.message || "Could not send reset link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <BackgroundDocs />
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-neutral-200/70 bg-white/80 backdrop-blur p-6 shadow space-y-4">
        <h1 className="text-2xl font-semibold">Log in</h1>

        <input
          type="email"
          placeholder="you@example.com"
          className="w-full rounded-xl border border-neutral-300/80 px-3.5 py-2.5 bg-white/90"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim())}
          required
        />

        <input
          type="password"
          placeholder="Your password"
          className="w-full rounded-xl border border-neutral-300/80 px-3.5 py-2.5 bg-white/90"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-white font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? "Checking…" : "Continue"}
        </button>

        {msg && <p className="text-sm text-red-600">{msg}</p>}

        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={handleResetPassword} className="text-blue-600 hover:underline">
            Forgot password?
          </button>
          {offerOtpFallback && (
            <button type="button" onClick={loginWithCodeOnly} className="text-blue-600 hover:underline">
              Send me a login code instead
            </button>
          )}
        </div>

        <div className="text-sm">
          New here?{" "}
          <a href="/register" className="text-blue-600 hover:underline">Create an account</a>
        </div>
      </form>
    </main>
  );
}
