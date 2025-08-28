// src/pages/Landing.jsx
import { Link } from "react-router-dom";
// If you actually have a BetaNotice component, keep this import & <BetaNotice />.
// Otherwise remove both lines.
import BetaNotice from "../components/BetaNotice";

export default function Landing() {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Optional site-wide banner */}
      {typeof BetaNotice === "function" && <BetaNotice />}

      {/* HERO */}
      <main className="flex-1">
        <section className="mx-auto max-w-screen-xl px-6 py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: text + CTAs */}
          <div className="text-center lg:text-left">
            <h1 className="text-5xl font-extrabold text-black leading-tight">
              Your Documents. <span className="text-blue-600">Smarter.</span>
            </h1>
            <p className="mt-4 text-lg text-gray-800 max-w-lg mx-auto lg:mx-0">
              Upload PDFs, images, or audio. Get instant summaries and ask questions across files—all in one place.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center lg:items-start gap-4">
              <Link
                to="/register"
                className="px-6 py-3 rounded-lg bg-blue-600 text-white shadow hover:bg-blue-700"
              >
                Get Started
              </Link>
              <Link to="/login" className="text-blue-600 font-medium hover:underline">
                I already have an account
              </Link>
            </div>
          </div>

          {/* Right: hero image (make sure /public/docs-hero.png exists) */}
          <div className="flex justify-center lg:justify-end">
            <img
              src="/docs-hero.png"
              alt="Talking documents"
              className="w-full max-w-md lg:max-w-lg object-contain rounded-2xl shadow"
            />
          </div>
        </section>

        {/* HOW IT WORKS (3 cards) */}
        <section className="bg-gray-50 border-t border-black/5">
          <div className="mx-auto max-w-screen-xl px-6 py-16">
            <h2 className="text-2xl font-bold text-black text-center mb-10">How it works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-2xl bg-white border border-black/5 shadow p-6">
                <h3 className="font-semibold">1) Upload</h3>
                <p className="mt-2 text-gray-600 text-sm">
                  Drop in PDFs, images, or audio. We extract the text automatically.
                </p>
              </div>
              <div className="rounded-2xl bg-white border border-black/5 shadow p-6">
                <h3 className="font-semibold">2) Summarize</h3>
                <p className="mt-2 text-gray-600 text-sm">
                  Get clean, helpful summaries you can share or save.
                </p>
              </div>
              <div className="rounded-2xl bg-white border border-black/5 shadow p-6">
                <h3 className="font-semibold">3) Ask Anything</h3>
                <p className="mt-2 text-gray-600 text-sm">
                  Ask questions across one or many files—answers are grounded in your docs.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-gray-100 border-t border-black/5">
        <div className="mx-auto max-w-screen-xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <div>© {year} AskMyDocs</div>
          <div className="text-right">
            Need help?{" "}
            <a href="mailto:AskMyDocsHelp@gmail.com" className="text-blue-600 hover:underline">
              Contact support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
