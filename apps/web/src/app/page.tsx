// EXPLRD — App Store install landing page.
//
// The website is a single, minimal page that points people to the iOS app.
// Drop the App Store URL into APP_STORE_URL once the listing is live; until
// then the badge renders in a non-interactive "coming soon" state.
const APP_STORE_URL = "https://apps.apple.com/app/explrd/id6762485826";

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" aria-hidden>
      <path d="M17.05 12.54c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.18-1.72-1.35-.14-2.64.79-3.33.79-.69 0-1.75-.77-2.87-.75-1.48.02-2.84.86-3.6 2.18-1.53 2.66-.39 6.6 1.1 8.76.72 1.06 1.59 2.25 2.72 2.21 1.09-.04 1.5-.71 2.82-.71 1.31 0 1.69.71 2.84.69 1.17-.02 1.92-1.08 2.64-2.14.83-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.32-3.5zM14.88 5.86c.6-.73 1.01-1.74.9-2.75-.87.04-1.92.58-2.55 1.3-.56.64-1.05 1.67-.92 2.65.97.08 1.96-.49 2.57-1.2z" />
    </svg>
  );
}

export default function Home() {
  const badge = (
    <span className="group inline-flex items-center gap-3 rounded-2xl bg-white px-6 py-4 text-[#0a0f1c] shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition">
      <AppleLogo />
      <span className="flex flex-col text-left leading-tight">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b7280]">
          {APP_STORE_URL ? "Download on the" : "Coming soon to the"}
        </span>
        <span className="text-[19px] font-semibold tracking-[-0.02em]">App Store</span>
      </span>
    </span>
  );

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[linear-gradient(165deg,_#0f1d38_0%,_#1a3050_46%,_#0a0f1c_100%)] px-6 text-white">
      {/* Ambient glow — the app's signature blue */}
      <div className="pointer-events-none absolute -top-1/3 left-1/2 h-[640px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(0,122,255,0.22)_0%,_transparent_62%)] blur-2xl" />
      <div className="pointer-events-none absolute bottom-[-22%] left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(139,92,246,0.14)_0%,_transparent_60%)] blur-2xl" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.42em] text-white/45">
          The travel passport
        </span>

        <h1 className="mt-6 text-[clamp(3rem,16vw,5rem)] font-extrabold leading-none tracking-[-0.06em]">
          EXPLRD
        </h1>

        <p className="mt-6 max-w-sm text-[17px] leading-relaxed text-white/65">
          Track every place you&apos;ve explored, see your travel stats come to
          life, and share your map with friends.
        </p>

        <div className="mt-12">
          {APP_STORE_URL ? (
            <a href={APP_STORE_URL} className="inline-block transition hover:-translate-y-0.5">
              {badge}
            </a>
          ) : (
            <div className="cursor-default opacity-95">{badge}</div>
          )}
        </div>

        {!APP_STORE_URL ? (
          <p className="mt-5 text-[13px] font-medium tracking-[0.02em] text-white/40">
            Launching soon on iPhone.
          </p>
        ) : null}
      </div>

      <footer className="absolute bottom-7 z-10 text-[12px] tracking-[0.04em] text-white/30">
        © {new Date().getFullYear()} EXPLRD
      </footer>
    </main>
  );
}
