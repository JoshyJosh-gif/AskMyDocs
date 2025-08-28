// src/pages/Register.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Register() {
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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;

      // Remember email for Verify page (we removed the email input there)
      sessionStorage.setItem("amd-verify-email", email);
      nav("/verify?mode=signup"); // IMPORTANT: signup mode
    } catch (ex) {
      setErr(ex.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">Create your account</h1>
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
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="text-sm text-gray-500 mt-3">
        We’ll email you a confirmation link and a 6-digit code. Either works — if you click the link,
        you won’t need the code.
      </p>
    </main>
  );
}
