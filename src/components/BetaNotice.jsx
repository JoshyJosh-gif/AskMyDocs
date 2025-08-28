// src/components/BetaNotice.jsx
import { useEffect, useState } from "react";

const LS_KEY = "amd_beta_notice_dismissed";

export default function BetaNotice() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem(LS_KEY) === "1";
    if (dismissed) setOpen(false);
  }, []);

  if (!open) return null;

  return (
    <div className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
      <div className="mx-auto max-w-screen-2xl px-4 py-3 flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold tracking-wide">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-300" />
          BETA
        </span>

        <p className="text-sm/5 opacity-95">
          You’re using the early preview of <span className="font-semibold">Ask My Docs</span>.  
          Free tier limits: <span className="font-semibold">50 summaries/day</span> and <span className="font-semibold">100 questions/day</span>.  
          Subscriptions: <span className="font-semibold">coming soon.</span>
        </p>

        <div className="ms-auto flex items-center gap-4">
          <a
            href="mailto:AskMyDocsHelp@gmail.com"
            className="text-sm underline decoration-white/60 underline-offset-4 hover:decoration-white"
          >
            Contact support
          </a>
          <button
            onClick={() => {
              localStorage.setItem(LS_KEY, "1");
              setOpen(false);
            }}
            className="text-sm/5 rounded-lg bg-white/15 px-3 py-1.5 hover:bg-white/20"
            aria-label="Dismiss beta notice"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
