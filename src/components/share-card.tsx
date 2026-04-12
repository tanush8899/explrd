"use client";

import type { RefObject } from "react";
import type { ExplrdStats } from "@/lib/stats";

// ─── Passport Card ─────────────────────────────────────────────────────────
// Full-featured card used in the share tab, captured as an image

type PassportCardProps = {
  displayName: string;
  stats: ExplrdStats;
  cardRef?: RefObject<HTMLDivElement | null>;
};

export function PassportCard({ displayName, stats, cardRef }: PassportCardProps) {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const pct = stats.percentWorldTraveled.toFixed(1);

  return (
    <div
      ref={cardRef}
      style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}
      className="w-full overflow-hidden rounded-[22px] bg-[#080d18] text-white"
    >
      {/* Top band */}
      <div className="flex items-center justify-between bg-[#0f1623] px-5 py-3">
        <span className="text-[9px] font-bold uppercase tracking-[0.32em] text-[#3a5a8a]">
          Explrd Passport
        </span>
        <span className="text-[9px] font-medium tracking-wide text-[#2d4466]">
          {today}
        </span>
      </div>

      <div className="p-5">
        {/* Name row */}
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-[0.26em] text-[#2a4060]">
              Traveler
            </div>
            <div className="mt-1.5 truncate text-2xl font-bold leading-none tracking-[-0.04em] text-white">
              {displayName}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[9px] font-bold uppercase tracking-[0.26em] text-[#2a4060]">
              World
            </div>
            <div className="mt-1.5 text-2xl font-bold leading-none tracking-[-0.04em] text-[#3b82f6]">
              {pct}%
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-4 h-px bg-[#131d2e]" />

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { label: "Cities", value: stats.uniqueCities },
            { label: "Countries", value: stats.uniqueCountries },
            { label: "Continents", value: stats.uniqueContinents },
            { label: "Score", value: stats.score },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-[#0f1623] px-2 py-3 text-center">
              <div className="text-[7.5px] font-bold uppercase tracking-[0.2em] text-[#2a4060]">
                {label}
              </div>
              <div className="mt-1.5 text-lg font-bold tracking-tight text-white">{value}</div>
            </div>
          ))}
        </div>

        {/* World progress bar */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#2a4060]">
              World explored
            </span>
            <span className="text-[9px] font-semibold text-[#3b5a8a]">{pct}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-[#131d2e]">
            <div
              className="h-full rounded-full bg-[#3b82f6]"
              style={{ width: `${Math.min(parseFloat(pct), 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[#0f1623] px-5 py-2.5">
        <span className="text-[8px] font-bold uppercase tracking-[0.38em] text-[#1a2d47]">
          explrd.app
        </span>
        <span className="text-[9px] text-[#1a2d47]">✦ ✦ ✦</span>
      </div>
    </div>
  );
}

// ─── Legacy default export ──────────────────────────────────────────────────
// Used by /u/[slug] public profile page

type LegacyShareCardProps = {
  profile: {
    display_name: string | null;
    public_slug: string | null;
  };
  stats: {
    totalPlaces: number;
    uniqueCities: number;
    uniqueCountries: number;
    uniqueContinents: number;
    score: number;
  };
};

export default function ShareCard({ profile, stats }: LegacyShareCardProps) {
  return (
    <div className="overflow-hidden rounded-[22px] bg-[#080d18] text-white">
      <div className="flex items-center justify-between bg-[#0f1623] px-5 py-3">
        <span className="text-[9px] font-bold uppercase tracking-[0.32em] text-[#3a5a8a]">
          Explrd Passport
        </span>
      </div>
      <div className="p-5">
        <div className="text-[9px] font-bold uppercase tracking-[0.26em] text-[#2a4060]">Traveler</div>
        <div className="mt-1.5 text-2xl font-bold tracking-[-0.04em] text-white">
          {profile.display_name?.trim() || "Explrd Traveler"}
        </div>
        <div className="my-4 h-px bg-[#131d2e]" />
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Cities", value: stats.uniqueCities },
            { label: "Countries", value: stats.uniqueCountries },
            { label: "Continents", value: stats.uniqueContinents },
            { label: "Score", value: stats.score },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#2a4060]">{label}</div>
              <div className="mt-1 text-2xl font-bold tracking-tight text-white">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
