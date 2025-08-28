// src/pages/Reset.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Reset() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    // Check if we are in recovery mode (PASSWORD_RECOVERY state)
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session && data.session.user) {
        // Supabase automatically puts the user in recovery session after clicking the email link
        setRecoveryMode(true);
      }
    })();
  }, []);

  async function sendResetEmail(e) {
    e.preventDefault();
    setMsg(""); setErr(""); setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/reset`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setMsg("If that email exists, a reset link has been sent.");
    } catch (ex) {
      setErr(ex.message || "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  async function updatePassword(e) {
    e.preventDefault();
    setMsg(""); setErr(""); setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMsg("Password updated! You can now log in with your new password.");
      setRecoveryMode(false);
    } catch (ex) {
      setErr(ex.message || "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-white">
      {!recoveryMode ? (
        // Mode 1: Request email
        <form onSubmit={sendResetEmail} className="w-full max-w-sm p-6 rounded-xl border border-black/10 bg-white">
          <h1 className="text-2xl font-semibold">Reset password</h1>
          <p className="text-sm text-gray-600 mt-2">Enter your email to get a reset link.</p>

          <label className="block mt-6 text-sm font-medium">Email</label>
          <input
            type="email"
            required
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full rounded-lg bg-blue-600 text-white py-2 font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send reset link"}
          </button>

          {msg && <div className="mt-3 text-sm text-green-700">{msg}</div>}
          {err && <div className="mt-3 text-sm text-red-700">{err}</div>}
        </form>
      ) : (
        // Mode 2: Set new password
        <form onSubmit={updatePassword} className="w-full max-w-sm p-6 rounded-xl border border-black/10 bg-white">
          <h1 className="text-2xl font-semibold">Set new password</h1>
          <p className="text-sm text-gray-600 mt-2">Enter your new password below.</p>

          <label className="block mt-6 text-sm font-medium">New Password</label>
          <input
            type="password"
            required
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full rounded-lg bg-blue-600 text-white py-2 font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Updating…" : "Update Password"}
          </button>

          {msg && <div className="mt-3 text-sm text-green-700">{msg}</div>}
          {err && <div className="mt-3 text-sm text-red-700">{err}</div>}
        </form>
      )}
    </div>
  );
}
