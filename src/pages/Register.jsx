import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import BackgroundDocs from "../components/BackgroundDocs";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    if (password !== confirm) {
      setMsg("Passwords do not match");
      return;
    }
    setLoading(true);

    try {
      const { error: upErr } = await supabase.auth.signUp({ email, password });
      if (upErr) throw upErr;

      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (otpErr) throw otpErr;

      localStorage.setItem("pendingEmail", email);
      navigate(`/verify?email=${encodeURIComponent(email)}&mode=signup2fa`);
    } catch (err) {
      setMsg(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <BackgroundDocs />
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-neutral-200/70 bg-white/80 backdrop-blur p-6 shadow space-y-4">
        <h1 className="text-2xl font-semibold">Register</h1>

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
          placeholder="Create a password"
          className="w-full rounded-xl border border-neutral-300/80 px-3.5 py-2.5 bg-white/90"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Confirm password"
          className="w-full rounded-xl border border-neutral-300/80 px-3.5 py-2.5 bg-white/90"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-white font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? "Creating…" : "Continue"}
        </button>

        {msg && <p className="text-sm text-red-600">{msg}</p>}

        <div className="text-sm">
          Already have an account?{" "}
          <a href="/login" className="text-blue-600 hover:underline">Log in</a>
        </div>
      </form>
    </main>
  );
}
