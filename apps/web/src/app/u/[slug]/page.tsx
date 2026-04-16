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
  loading: () => <div className="h-[360px] w-full animate-pulse rounded-xl bg-[#e8eaed]" />,
});

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[#e8eaed]">
      <div
        className="h-full rounded-full bg-[#111214]"
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
      <div className="flex min-h-screen items-center justify-center bg-[#fafbfc] px-6">
        <p className="text-sm font-medium text-[#868c94]">Loading shared map...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafbfc] px-5">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111214] text-sm font-bold tracking-wide text-white">
            Ex
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-[#111214]">Profile unavailable</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#868c94]">
            {error ?? "This profile could not be found or is not public right now."}
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex rounded-xl bg-[#111214] px-5 py-2.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition hover:bg-[#2a2d31]"
          >
            Open Explr
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafbfc] px-5 pb-10 pt-[calc(env(safe-area-inset-top)+16px)] text-[#111214]">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        {/* Header */}
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-[#e1e4e8] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#868c94]">Shared map</div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.03em] text-[#111214]">
              {profile.display_name || "Explr Traveler"}
            </h1>
            <div className="mt-2 text-sm text-[#868c94]">@{profile.public_slug}</div>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[#868c94]">
              {profile.bio?.trim() || "A map-first snapshot of the places this traveler has explored so far."}
            </p>

            <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
              <div className="rounded-xl border border-[#e8eaed] bg-[#fafbfc] px-4 py-3.5">
                <div className="text-[11px] uppercase tracking-[0.14em] text-[#868c94]">Countries</div>
                <div className="mt-1.5 text-2xl font-semibold tracking-tight text-[#111214]">{stats.uniqueCountries}</div>
              </div>
              <div className="rounded-xl border border-[#e8eaed] bg-[#fafbfc] px-4 py-3.5">
                <div className="text-[11px] uppercase tracking-[0.14em] text-[#868c94]">Cities</div>
                <div className="mt-1.5 text-2xl font-semibold tracking-tight text-[#111214]">{stats.uniqueCities}</div>
              </div>
              <div className="rounded-xl border border-[#e8eaed] bg-[#fafbfc] px-4 py-3.5">
                <div className="text-[11px] uppercase tracking-[0.14em] text-[#868c94]">Score</div>
                <div className="mt-1.5 text-2xl font-semibold tracking-tight text-[#111214]">{stats.score}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#e1e4e8] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <ShareCard
              profile={{ display_name: profile.display_name, public_slug: profile.public_slug }}
              stats={stats}
            />
          </div>
        </section>

        {/* Map */}
        <section className="overflow-hidden rounded-xl border border-[#e1e4e8] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <PlacesMap
            places={places}
            mode="country"
            heightClassName="h-[52svh] min-h-[360px]"
            containerClassName="h-full w-full"
            theme="light"
            focusStrategy="world"
          />
        </section>

        {/* Coverage & Recent */}
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-[#e1e4e8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#868c94]">Country coverage</div>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[#111214]">
              Where the map is deepest
            </h2>

            {coverage.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-[#e1e4e8] bg-[#fafbfc] px-4 py-5 text-center text-sm text-[#868c94]">
                No saved places yet.
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {coverage.slice(0, 6).map((entry) => (
                  <div key={entry.country} className="rounded-xl border border-[#e8eaed] bg-[#fafbfc] px-4 py-3.5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-[#111214]">{entry.country}</div>
                        <div className="mt-0.5 text-xs text-[#868c94]">
                          {entry.exploredCities} cities · {entry.exploredPlaces} places
                        </div>
                      </div>
                      <div className="text-lg font-semibold tracking-tight text-[#111214]">
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

          <div className="rounded-xl border border-[#e1e4e8] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#868c94]">Recent places</div>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[#111214]">
              Latest additions
            </h2>

            {recentPlaces.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-[#e1e4e8] bg-[#fafbfc] px-4 py-5 text-center text-sm text-[#868c94]">
                Nothing to show yet.
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {recentPlaces.map((place) => (
                  <div key={place.place_id} className="rounded-xl border border-[#e8eaed] bg-[#fafbfc] px-4 py-3.5">
                    <div className="text-sm font-semibold text-[#111214]">{getPlaceMemoryTitle(place)}</div>
                    <div className="mt-0.5 text-xs text-[#868c94]">{getPlaceMemoryMeta(place) || "Explored geography"}</div>
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
