"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "@/lib/auth";
import { useSession } from "@/lib/use-session";

function getDisplayName(user: ReturnType<typeof useSession>["user"]) {
  const metadataName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user?.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;

  if (metadataName?.trim()) return metadataName.trim();
  if (user?.email) return user.email.split("@")[0];
  return "Explorer";
}

function getInitials(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "EX";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export default function ProfilePage() {
  const { loading, user } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      window.location.replace("/login");
    }
  }, [loading, user]);

  const displayName = useMemo(() => getDisplayName(user), [user]);
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);

    try {
      await signOut();
      window.location.replace("/login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not log out.");
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#74cdfc] px-6">
        <p className="text-sm font-medium text-white/90">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#74cdfc_0%,#63c3f7_44%,#a3e586_100%)] px-4 pb-10 pt-[calc(env(safe-area-inset-top)+18px)] sm:px-6">
      <main className="mx-auto flex min-h-[calc(100vh-40px)] max-w-xl flex-col">
        <div className="flex items-start justify-between">
          <div className="rounded-full bg-black px-5 py-3 text-sm font-semibold tracking-[0.24em] text-white">
            Explrd
          </div>
          <Link
            href="/"
            className="rounded-full bg-white/86 px-5 py-3 text-sm font-medium text-[#1c1c1e] shadow-[0_16px_40px_rgba(0,0,0,0.12)] backdrop-blur"
          >
            Back
          </Link>
        </div>

        <div className="mt-auto rounded-[38px] bg-[rgba(255,255,255,0.93)] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.16)] backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="flex h-18 w-18 items-center justify-center rounded-full bg-[#f2da73] text-2xl font-semibold text-white">
              {initials}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-[#9ca1a8]">Profile</div>
              <div className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#111214]">{displayName}</div>
              <div className="mt-1 text-sm text-[#8d9298]">{user?.email ?? "Signed in"}</div>
            </div>
          </div>

          <div className="mt-6 rounded-[28px] bg-[#f6f7f8] p-5">
            <div className="text-sm leading-7 text-[#7f848b]">
              This screen stays intentionally minimal. The only account action here is logging out.
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="mt-5 w-full rounded-full bg-[#111214] px-5 py-4 text-sm font-medium text-white disabled:opacity-60"
            >
              {signingOut ? "Logging out..." : "Log out"}
            </button>
          </div>

          {error ? <div className="mt-4 text-sm text-[#d1604d]">{error}</div> : null}
        </div>
      </main>
    </div>
  );
}
