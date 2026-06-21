// EXPLRD — Privacy Policy. Linked from the App Store listing.
export const metadata = {
  title: "Privacy Policy — EXPLRD",
  description: "How EXPLRD collects, uses, and protects your data.",
};

const UPDATED = "June 20, 2026";
const CONTACT = "support@explrd.app";

export default function Privacy() {
  return (
    <main className="min-h-[100dvh] bg-[linear-gradient(165deg,_#0f1d38_0%,_#1a3050_46%,_#0a0f1c_100%)] px-6 py-20 text-white">
      <article className="mx-auto w-full max-w-2xl">
        <a
          href="/"
          className="text-[13px] font-medium uppercase tracking-[0.18em] text-white/45 transition hover:text-white/70"
        >
          ← EXPLRD
        </a>

        <h1 className="mt-8 text-4xl font-extrabold tracking-[-0.03em]">Privacy Policy</h1>
        <p className="mt-3 text-[14px] text-white/45">Last updated: {UPDATED}</p>

        <div className="mt-10 space-y-8 text-[16px] leading-relaxed text-white/75">
          <p>
            EXPLRD (&ldquo;we,&rdquo; &ldquo;us&rdquo;) helps you map the cities you&apos;ve visited
            and see your travel stats. This policy explains what we collect, why, and the choices
            you have. We aim to collect as little as possible.
          </p>

          <section>
            <h2 className="text-xl font-bold text-white">Information you provide</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong className="font-semibold text-white/90">Account details</strong> — your email
                address and name when you sign up (directly or via Google sign-in), and a username you
                choose.
              </li>
              <li>
                <strong className="font-semibold text-white/90">Places</strong> — the cities and
                locations you add to your map, including their coordinates.
              </li>
              <li>
                <strong className="font-semibold text-white/90">Friends</strong> — the connections you
                make and friend requests you send within the app.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">Photos and location</h2>
            <p className="mt-3">
              If you grant photo access, EXPLRD reads the location metadata stored in your photos to
              suggest cities you&apos;ve visited. This processing happens entirely{" "}
              <strong className="font-semibold text-white/90">on your device</strong> — your photos
              are never uploaded to our servers and never leave your device. Only the places you
              choose to save (city names and coordinates) are stored in your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">How we use your information</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>To build and display your personal map, passport, and travel stats.</li>
              <li>To let you compare your travels with friends.</li>
              <li>To send push notifications you&apos;ve enabled, such as friend requests.</li>
              <li>To operate, secure, and improve the app.</li>
            </ul>
            <p className="mt-3">
              We do <strong className="font-semibold text-white/90">not</strong> sell your personal
              data, and we do not use it for third-party advertising.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">How your data is stored</h2>
            <p className="mt-3">
              Your account and saved places are stored securely using our backend provider (Supabase).
              Access is protected by authentication, and data is transmitted over encrypted
              connections.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">Your choices and rights</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>You can revoke photo, location, and notification permissions at any time in iOS Settings.</li>
              <li>
                You can <strong className="font-semibold text-white/90">delete your account</strong> at
                any time from within the app (Passport tab → profile icon → Delete Account). This
                permanently removes your account and associated data.
              </li>
              <li>You can request a copy of your data, or ask questions, by contacting us.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">Children</h2>
            <p className="mt-3">
              EXPLRD is not directed to children under 13, and we do not knowingly collect data from
              them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">Changes to this policy</h2>
            <p className="mt-3">
              We may update this policy from time to time. Material changes will be reflected by the
              &ldquo;Last updated&rdquo; date above.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">Contact</h2>
            <p className="mt-3">
              Questions about this policy or your data? Email us at{" "}
              <a className="font-semibold text-white underline" href={`mailto:${CONTACT}`}>
                {CONTACT}
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
