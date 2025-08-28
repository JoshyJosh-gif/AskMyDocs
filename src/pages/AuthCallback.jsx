// src/pages/AuthCallback.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
  const [msg, setMsg] = useState("Completing sign-in…");

  useEffect(() => {
    (async () => {
      try {
        // Handles links that arrive with ?code=... (PKCE/OTP/magic)
        await supabase.auth.exchangeCodeForSession(window.location.href);
        window.location.replace("/dashboard");
      } catch (err) {
        setMsg(err?.message || "Could not complete sign-in. Try logging in again.");
      }
    })();
  }, []);

  return (
    <main className="min-h-screen grid place-items-center">
      <div className="text-sm text-neutral-700">{msg}</div>
    </main>
  );
}
