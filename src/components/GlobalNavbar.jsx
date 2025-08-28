// src/components/GlobalNavbar.jsx
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function GlobalNavbar() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (mounted) setUser(data?.user || null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user || null);
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // close dropdown when route changes
  useEffect(() => setOpen(false), [loc.pathname]);

  return (
    <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-black/5">
      <div className="mx-auto max-w-screen-2xl px-4 py-3 flex items-center justify-between">
        {/* Logo => Home */}
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain" />
          <span className="font-semibold hidden sm:inline">AskMyDocs</span>
        </Link>

        <div className="flex items-center gap-6 text-sm font-medium">
          {/* Left spot: Login OR Account dropdown */}
          {!user ? (
            <Link to="/login" className="hover:text-blue-600">Login</Link>
          ) : (
            <div className="relative">
              <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 hover:text-blue-600"
                aria-haspopup="menu"
                aria-expanded={open ? "true" : "false"}
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white">
                  {user.email?.[0]?.toUpperCase() || "U"}
                </span>
                <span className="hidden sm:inline max-w-[180px] truncate">{user.email}</span>
                <span aria-hidden>▾</span>
              </button>
              {open && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-black/10 shadow"
                >
                  <button
                    role="menuitem"
                    className="w-full text-left px-4 py-2 hover:bg-black/[0.03]"
                    onClick={() => alert("Manage subscription (coming soon)")}
                  >
                    Manage subscription
                  </button>
                  <button
                    role="menuitem"
                    className="w-full text-left px-4 py-2 hover:bg-black/[0.03]"
                    onClick={() => alert("Account settings (coming soon)")}
                  >
                    Account settings
                  </button>
                  <button
                    role="menuitem"
                    className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50"
                    onClick={async () => { await supabase.auth.signOut(); }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Middle spot: Register (unchanged) */}
          <Link to="/register" className="hover:text-blue-600">Register</Link>

          {/* Right spot: Get Started (blue) OR Dashboard (blue) */}
          {!user ? (
            <Link
              to="/register"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
            >
              Get Started
            </Link>
          ) : (
            <Link
              to="/dashboard"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
            >
              Dashboard
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
