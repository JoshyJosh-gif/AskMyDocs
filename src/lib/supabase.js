// src/lib/supabase.js
import { createClient } from "@supabase/supabase-js";

// Per-tab session: clears only when all tabs are closed.
const storage = {
  getItem: (key) => sessionStorage.getItem(key),
  setItem: (key, value) => sessionStorage.setItem(key, value),
  removeItem: (key) => sessionStorage.removeItem(key),
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
  console.error("Missing Supabase env vars VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
}

export const supabase =
  supabaseUrl && supabaseAnon
    ? createClient(supabaseUrl, supabaseAnon, {
        auth: {
          persistSession: true,
          storage,                  // per-tab storage
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

// ---------- Multi-tab session share with BroadcastChannel ----------
const bc = new BroadcastChannel("amd-auth");
let bootstrapped = false;

// If a new tab boots without a session, request it from any existing tab.
export async function bootstrapSession() {
  if (!supabase) return;

  const { data: s } = await supabase.auth.getSession();
  if (s?.session) { bootstrapped = true; return true; }

  return new Promise((resolve) => {
    const onMessage = async (ev) => {
      if (ev?.data?.type === "AMD_SESSION_PUSH") {
        const { access_token, refresh_token } = ev.data.payload || {};
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
          bootstrapped = true;
          bc.removeEventListener("message", onMessage);
          resolve(true);
        }
      }
    };
    bc.addEventListener("message", onMessage);
    // Ask other tabs for a session
    bc.postMessage({ type: "AMD_SESSION_REQUEST" });
    // Failsafe
    setTimeout(() => { bc.removeEventListener("message", onMessage); resolve(false); }, 1500);
  });
}

// When we have a session, answer requests from new tabs.
if (supabase) {
  // Reply to session requests
  bc.addEventListener("message", async (ev) => {
    if (ev?.data?.type === "AMD_SESSION_REQUEST") {
      const { data: s } = await supabase.auth.getSession();
      if (s?.session?.access_token && s?.session?.refresh_token) {
        bc.postMessage({
          type: "AMD_SESSION_PUSH",
          payload: {
            access_token: s.session.access_token,
            refresh_token: s.session.refresh_token,
          },
        });
      }
    }
  });

  // Broadcast session changes (login, refresh, logout)
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session?.access_token || !session?.refresh_token) return;
    bc.postMessage({
      type: "AMD_SESSION_PUSH",
      payload: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
    });
  });
}
