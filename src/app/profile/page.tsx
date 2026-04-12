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
      <div className="flex min-h-screen items-center justify-center bg-[#fafbfc]">
        <p className="text-sm font-medium text-[#868c94]">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafbfc] px-5 pb-10 pt-[calc(env(safe-area-inset-top)+16px)]">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="rounded-lg border border-[#e1e4e8] bg-white px-3.5 py-2 text-sm font-medium text-[#3d4249] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-[#f8f9fa]"
          >
            Back
          </Link>
        </div>

        <div className="mt-10 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#111214] text-2xl font-semibold text-white">
            {initials}
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-[#111214]">{displayName}</h1>
          <p className="mt-1.5 text-sm text-[#868c94]">{user?.email ?? "Signed in"}</p>
        </div>

        <div className="mt-8 rounded-xl border border-[#e1e4e8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="text-sm font-semibold text-[#111214]">Account</h2>
          <p className="mt-2 text-sm leading-6 text-[#868c94]">
            This screen stays minimal. The only account action here is logging out.
          </p>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="mt-5 w-full rounded-xl bg-[#111214] px-4 py-2.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition hover:bg-[#2a2d31] disabled:opacity-40"
          >
            {signingOut ? "Logging out..." : "Log out"}
          </button>

          {error ? (
            <div className="mt-4 rounded-xl border border-[#f5c6c6] bg-[#fef2f2] px-3.5 py-3 text-sm text-[#b91c1c]">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
