"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import ShareCard from "@/components/share-card";
import { getPlaceMemoryMeta, getPlaceMemoryTitle } from "@/lib/exploration";
import { getCountryCoverage, getRecentPlaces } from "@/lib/journey";
import { getExplrdStats } from "@/lib/stats";
import type { ApiErrorResponse, PublicProfilePayload, SavedPlace, UserProfile } from "@/lib/types";

type PublicProfileResponse = ApiErrorResponse & Partial<PublicProfilePayload>;

const PlacesMap = dynamic(() => import("@/components/places-map"), {
  ssr: false,
  loading: () => <div className="h-[360px] w-full animate-pulse rounded-[30px] bg-[#d3e7e5]" />,
});

function ProgressBar({
  value,
}: {
  value: number;
}) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#d8e7e5]">
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,#1b595a_0%,#db7f54_100%)]"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  );
}

export default function PublicProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [places, setPlaces] = useState<SavedPlace[]>([]);

  const stats = useMemo(() => getExplrdStats(places), [places]);
  const coverage = useMemo(() => getCountryCoverage(places), [places]);
  const recentPlaces = useMemo(() => getRecentPlaces(places, 4), [places]);

  useEffect(() => {
    async function loadPublicProfile() {
      try {
        const res = await fetch(`/api/public-profile/${encodeURIComponent(slug)}`);
        const out = (await res.json().catch(() => ({}))) as PublicProfileResponse;

        if (!res.ok) {
          setError(out.details ?? out.error ?? "This public profile is unavailable.");
          return;
        }

        setProfile(out.profile ?? null);
        setPlaces(Array.isArray(out.places) ? out.places : []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "This public profile is unavailable.");
      } finally {
        setLoading(false);
      }
    }

    loadPublicProfile();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-[#587176]">Loading shared map...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen px-4 py-[calc(env(safe-area-inset-top)+20px)] sm:px-6">
        <main className="mx-auto max-w-3xl rounded-[34px] border border-white/70 bg-white/88 p-8 text-center shadow-[0_34px_80px_rgba(7,44,52,0.12)] backdrop-blur">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#4d6a6f]">Explrd</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-[#13252a]">Public profile unavailable</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#607a7f]">
            {error ?? "This profile could not be found or is not public right now."}
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex rounded-full bg-[#13252a] px-5 py-3 text-sm font-medium text-white transition hover:brightness-110"
          >
            Open Explrd
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-[calc(env(safe-area-inset-top)+18px)] text-[#13252a] sm:px-6">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <section className="grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(241,249,248,0.92))] p-6 shadow-[0_34px_80px_rgba(7,44,52,0.12)] backdrop-blur sm:p-7">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#4d6a6f]">Shared map</div>
            <h1 className="mt-4 text-5xl font-semibold leading-[0.95] tracking-[-0.06em] text-[#13252a]">
              {profile.display_name || "Explrd Traveler"}
            </h1>
            <div className="mt-3 text-sm font-medium text-[#607a7f]">@{profile.public_slug}</div>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[#607a7f]">
              {profile.bio?.trim() || "A map-first snapshot of the places this traveler has explored so far."}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-[#d5e7e5] bg-white/82 px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#688388]">Countries</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-[#13252a]">{stats.uniqueCountries}</div>
              </div>
              <div className="rounded-[24px] border border-[#d5e7e5] bg-white/82 px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#688388]">Cities</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-[#13252a]">{stats.uniqueCities}</div>
              </div>
              <div className="rounded-[24px] border border-[#d5e7e5] bg-white/82 px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#688388]">Score</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-[#13252a]">{stats.score}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[34px] border border-white/70 bg-white/88 p-5 shadow-[0_34px_80px_rgba(7,44,52,0.1)] backdrop-blur">
            <ShareCard
              profile={{
                display_name: profile.display_name,
                public_slug: profile.public_slug,
              }}
              stats={stats}
            />
          </div>
        </section>

        <section className="rounded-[34px] border border-white/70 bg-white/88 p-3 shadow-[0_34px_80px_rgba(7,44,52,0.1)] backdrop-blur">
          <div className="overflow-hidden rounded-[30px]">
            <PlacesMap
              places={places}
              mode="country"
              heightClassName="h-[52svh] min-h-[360px]"
              containerClassName="h-full w-full rounded-[30px] bg-transparent"
              theme="light"
              focusStrategy="world"
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[32px] border border-white/70 bg-white/88 p-5 shadow-[0_24px_60px_rgba(7,44,52,0.08)] backdrop-blur">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#4d6a6f]">
              Country coverage
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#13252a]">
              Where the map is deepest
            </h2>

            {coverage.length === 0 ? (
              <div className="mt-5 rounded-[26px] border border-dashed border-[#d0e2df] bg-[#f7fbfb] px-4 py-5 text-sm text-[#607a7f]">
                No saved places yet.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {coverage.slice(0, 6).map((entry) => (
                  <div key={entry.country} className="rounded-[26px] border border-[#d5e7e5] bg-[#f8fbfb] px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-base font-semibold tracking-tight text-[#13252a]">{entry.country}</div>
                        <div className="mt-1 text-sm text-[#607a7f]">
                          {entry.exploredCities} cities • {entry.exploredPlaces} places
                        </div>
                      </div>
                      <div className="text-right text-2xl font-semibold tracking-tight text-[#13252a]">
                        {entry.percentExplored !== null ? `${entry.percentExplored}%` : entry.exploredStates}
                      </div>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={entry.percentExplored ?? 0} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[32px] border border-white/70 bg-white/88 p-5 shadow-[0_24px_60px_rgba(7,44,52,0.08)] backdrop-blur">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#4d6a6f]">
              Recent places
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#13252a]">
              Latest additions
            </h2>

            {recentPlaces.length === 0 ? (
              <div className="mt-5 rounded-[26px] border border-dashed border-[#d0e2df] bg-[#f7fbfb] px-4 py-5 text-sm text-[#607a7f]">
                Nothing to show yet.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {recentPlaces.map((place) => (
                  <div key={place.place_id} className="rounded-[26px] border border-[#d5e7e5] bg-[#f8fbfb] px-4 py-4">
                    <div className="text-lg font-semibold tracking-tight text-[#13252a]">{getPlaceMemoryTitle(place)}</div>
                    <div className="mt-1 text-sm text-[#607a7f]">{getPlaceMemoryMeta(place) || "Explored geography"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
