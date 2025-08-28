// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      // 2FA-ish: require password + email OTP
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Ask Supabase to send the email OTP
      const { error: resendErr } = await supabase.auth.resend({
        type: "email", // login OTP type
        email,
      });
      if (resendErr) throw resendErr;

      sessionStorage.setItem("amd-verify-email", email);
      nav("/verify?mode=login"); // IMPORTANT: login mode
    } catch (ex) {
      setErr(ex.message || "Invalid credentials");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">Log in</h1>
      {err && <div className="mb-4 text-red-600">{err}</div>}
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full border rounded px-3 py-2"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          placeholder="Password"
          className="w-full border rounded px-3 py-2"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
        >
          {busy ? "Checking…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
