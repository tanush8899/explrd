"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { ExplrdStats } from "@/lib/stats";

// ─── Passport Card ─────────────────────────────────────────────────────────
// Full-featured card used in the share tab, captured as an image

type PassportCardProps = {
  displayName: string;
  stats: ExplrdStats;
  cardRef?: RefObject<HTMLDivElement | null>;
};

function useLandscapeCardLayout() {
  const [landscape, setLandscape] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const media = window.matchMedia("(orientation: landscape)");
    const update = () => setLandscape(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return landscape;
}

function useCardParallax() {
  const frameRef = useRef<number | null>(null);
  const [transformStyle, setTransformStyle] = useState<CSSProperties>({
    transform: "perspective(1200px) rotateX(0deg) rotateY(0deg) scale(1)",
  });

  useEffect(() => {
    function updateTransform(nextRotateX: number, nextRotateY: number) {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        setTransformStyle({
          transform: `perspective(1200px) rotateX(${nextRotateX.toFixed(2)}deg) rotateY(${nextRotateY.toFixed(2)}deg) scale(1.01)`,
        });
      });
    }

    function resetTransform() {
      updateTransform(0, 0);
    }

    function handleOrientation(event: DeviceOrientationEvent) {
      const beta = typeof event.beta === "number" ? event.beta : 0;
      const gamma = typeof event.gamma === "number" ? event.gamma : 0;
      const rotateX = Math.max(-5, Math.min(5, (beta - 45) * -0.08));
      const rotateY = Math.max(-7, Math.min(7, gamma * 0.18));
      updateTransform(rotateX, rotateY);
    }

    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      resetTransform();
    };
  }, []);

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    const rotateY = Math.max(-7, Math.min(7, x * 12));
    const rotateX = Math.max(-5, Math.min(5, y * -10));

    setTransformStyle({
      transform: `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(1.01)`,
    });
  }

  function handlePointerLeave() {
    setTransformStyle({
      transform: "perspective(1200px) rotateX(0deg) rotateY(0deg) scale(1)",
    });
  }

  return { transformStyle, handlePointerMove, handlePointerLeave };
}

export function PassportCard({ displayName, stats, cardRef }: PassportCardProps) {
  const landscape = useLandscapeCardLayout();
  const { transformStyle, handlePointerMove, handlePointerLeave } = useCardParallax();
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const pct = stats.percentWorldTraveled.toFixed(1);
  const statsItems = useMemo(
    () => [
      { label: "Cities", value: stats.uniqueCities },
      { label: "Countries", value: stats.uniqueCountries },
      { label: "Continents", value: stats.uniqueContinents },
    ],
    [stats.uniqueCities, stats.uniqueContinents, stats.uniqueCountries]
  );

  return (
    <div
      className="transform-gpu [transform-style:preserve-3d]"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ transition: "transform 180ms ease-out", ...transformStyle }}
    >
      <div
        ref={cardRef}
        style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}
        className={`relative w-full overflow-hidden rounded-[28px] border border-white/15 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.24),_transparent_30%),linear-gradient(145deg,_#2a1a58_0%,_#111827_42%,_#0a0f1a_100%)] text-white shadow-[0_24px_80px_rgba(13,15,24,0.34)] ${
          landscape ? "min-h-[250px]" : ""
        }`}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-16 top-[-56px] h-44 w-44 rounded-full bg-[#f7cf62]/28 blur-3xl" />
          <div className="absolute left-[-28px] top-14 h-36 w-36 rounded-full bg-[#72c5ff]/18 blur-3xl" />
          <div className="absolute inset-x-4 top-3 h-16 rounded-full bg-white/12 blur-2xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-white/35" />
          <div className="absolute inset-y-0 left-[-10%] w-1/2 -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)] opacity-70" />
        </div>

        <div className="relative">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.32em] text-white/78">
              Explrd Passport
            </span>
            <span className="text-[10px] font-medium tracking-[0.16em] text-white/65">
              {today}
            </span>
          </div>

          <div className={`${landscape ? "grid grid-cols-[1.2fr_0.8fr] gap-4 p-5" : "p-5 sm:p-6"}`}>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/60">Explorer</div>
              <div className="mt-2 text-[clamp(1.9rem,5vw,2.8rem)] font-semibold leading-[0.94] tracking-[-0.05em] text-white">
                {displayName}
              </div>

              <div className="mt-5 rounded-[22px] border border-white/12 bg-white/[0.08] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">
                      {pct}%
                    </div>
                  </div>
                  <div className="rounded-full border border-white/14 bg-black/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/72">
                    World Explored
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/20">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,_#f7cf62_0%,_#f2a8ff_55%,_#76d5ff_100%)] shadow-[0_0_18px_rgba(247,207,98,0.55)]"
                    style={{ width: `${Math.min(parseFloat(pct), 100)}%` }}
                  />
                </div>
              </div>
          </div>

          <div className={`${landscape ? "self-end" : "mt-5"}`}>
            <div className="grid grid-cols-3 gap-2.5">
              {statsItems.map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-[20px] border border-white/10 bg-black/15 px-3 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-md"
                  >
                    <div className="text-[8.5px] font-bold uppercase tracking-[0.2em] text-white/60">
                      {label}
                    </div>
                    <div className="mt-1.5 text-xl font-semibold tracking-[-0.04em] text-white">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
            <span className="text-[8px] font-bold uppercase tracking-[0.38em] text-white/45">
              explrd
            </span>
            <span className="text-[9px] tracking-[0.22em] text-white/45">Keep Exploring</span>
          </div>
        </div>
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
    <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.22),_transparent_28%),linear-gradient(145deg,_#2a1a58_0%,_#111827_42%,_#0a0f1a_100%)] text-white shadow-[0_24px_80px_rgba(13,15,24,0.3)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-14 top-[-48px] h-40 w-40 rounded-full bg-[#f7cf62]/24 blur-3xl" />
        <div className="absolute inset-x-4 top-3 h-14 rounded-full bg-white/10 blur-2xl" />
      </div>
      <div className="relative flex items-center justify-between border-b border-white/10 px-5 py-3.5">
        <span className="text-[9px] font-bold uppercase tracking-[0.32em] text-white/78">
          Explrd Passport
        </span>
      </div>
      <div className="relative p-5">
        <div className="text-[9px] font-bold uppercase tracking-[0.26em] text-white/58">Explorer</div>
        <div className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-white">
          {profile.display_name?.trim() || "Explrd Traveler"}
        </div>
        <div className="my-4 h-px bg-white/10" />
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Cities", value: stats.uniqueCities },
            { label: "Countries", value: stats.uniqueCountries },
            { label: "Continents", value: stats.uniqueContinents },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-[18px] border border-white/10 bg-black/15 px-3 py-3">
              <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/58">{label}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-white">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
