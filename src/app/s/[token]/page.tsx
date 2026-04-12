"use client";

import { iso31661 } from "iso-3166";
import dynamic from "next/dynamic";
import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { getPlaceHierarchy, type ContinentNode } from "@/lib/journey";
import { getExplrdStats } from "@/lib/stats";
import type { SavedPlace } from "@/lib/types";

const PlacesMap = dynamic(() => import("@/components/places-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#e8eef4]" />,
});

// ─── Helpers (mirrored from main page) ────────────────────────────────────

type SheetSnapPositions = { collapsed: number; mid: number; expanded: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[#e8eaed]">
      <div
        className="h-full rounded-full bg-[#2563eb]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

const countryNameToIso2 = iso31661.reduce((map, country) => {
  map.set(country.name.trim().toLowerCase(), country.alpha2);
  map.set(country.alpha2.trim().toLowerCase(), country.alpha2);
  map.set(country.alpha3.trim().toLowerCase(), country.alpha2);
  return map;
}, new Map<string, string>());

const countryFlagOverrides: Record<string, string> = {
  usa: "US", "united states": "US", "united states of america": "US",
  uk: "GB", "united kingdom": "GB", "great britain": "GB",
  czechia: "CZ", "czech republic": "CZ", vietnam: "VN", "viet nam": "VN",
  russia: "RU", "russian federation": "RU", bolivia: "BO",
  tanzania: "TZ", iran: "IR", moldova: "MD", venezuela: "VE",
  syria: "SY", laos: "LA", brunei: "BN", macedonia: "MK", "north macedonia": "MK",
  "korea, republic of": "KR", "south korea": "KR",
};

function getCountryFlag(country: string) {
  const normalized = country.trim().toLowerCase();
  const iso2 = countryFlagOverrides[normalized] ?? countryNameToIso2.get(normalized);
  if (!iso2 || iso2.length !== 2) return null;
  return iso2.toUpperCase().split("").map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join("");
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-[#dfe2e6] bg-[#f7f8f9] px-5 py-10 text-center">
      <div className="text-base font-semibold tracking-tight text-[#7f8389]">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#9aa0a6]">{description}</p>
    </div>
  );
}

// Read-only ContinentBlock — no delete buttons
function ContinentBlock({ node }: { node: ContinentNode }) {
  return (
    <section className="rounded-[30px] bg-[#f7f8f9] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#9aa0a6]">Continent</div>
          <div className="mt-1.5 text-2xl font-bold tracking-[-0.03em] text-[#111214]">{node.continent}</div>
          <div className="mt-1 text-sm text-[#8c9198]">
            {node.exploredCountries}/{node.totalCountries} countries explored
          </div>
        </div>
        <div className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-[#111214] shadow-[0_1px_3px_rgba(0,0,0,0.07)]">
          {node.percentExplored}%
        </div>
      </div>

      <div className="mt-4">
        <ProgressBar value={node.percentExplored} />
      </div>

      <div className="mt-4 space-y-4">
        {node.countries.map((country) => (
          <div
            key={`${node.continent}-${country.country}`}
            className="rounded-[24px] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[#111214]">
                  {getCountryFlag(country.country) ? (
                    <span className="text-xl leading-none">{getCountryFlag(country.country)}</span>
                  ) : null}
                  <span>{country.country}</span>
                </div>
                <div className="mt-1 text-sm text-[#8c9198]">
                  {country.exploredStates}
                  {country.totalStates ? `/${country.totalStates}` : ""} states • {country.exploredCities} cities
                </div>
              </div>
              <div className="min-w-[56px] rounded-full bg-[#f3f6f8] px-3 py-2 text-center text-sm font-semibold text-[#111214]">
                {country.percentExplored ?? 0}%
              </div>
            </div>

            <div className="mt-3">
              <ProgressBar value={country.percentExplored ?? 0} />
            </div>

            <div className="mt-4 space-y-3">
              {country.statesHierarchy.map((state) => (
                <div
                  key={`${country.country}-${state.state ?? "no-state"}`}
                  className="rounded-[20px] bg-[#f7f8f9] px-4 py-4"
                >
                  {state.state ? (
                    <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[#72777f]">
                      {state.state}
                    </div>
                  ) : null}

                  <div className={`${state.state ? "mt-3" : ""} space-y-3`}>
                    {state.cities.map((city) => (
                      <div
                        key={`${state.state ?? "no-state"}-${city.city}`}
                        className="rounded-[18px] bg-white px-4 py-3"
                      >
                        <div className="text-base font-semibold tracking-tight text-[#111214]">
                          {city.city}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Public Share Page ─────────────────────────────────────────────────────

type SharePayload = {
  displayName: string;
  places: SavedPlace[];
  expiresAt: string;
};

export default function PublicSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("Traveler");
  const [places, setPlaces] = useState<SavedPlace[]>([]);

  const [shellHeight, setShellHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [sheetOffset, setSheetOffset] = useState<number | null>(null);
  const [sheetDragging, setSheetDragging] = useState(false);

  const dragStateRef = useRef({ startY: 0, startOffset: 0 });
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const baseViewportHeightRef = useRef(0);

  const stats = useMemo(() => getExplrdStats(places), [places]);
  const hierarchy = useMemo(() => getPlaceHierarchy(places), [places]);

  const sheetHeight = useMemo(() => Math.max(viewportHeight - 18, 0), [viewportHeight]);

  const sheetSnaps = useMemo<SheetSnapPositions>(() => {
    if (!viewportHeight) return { collapsed: 0, mid: 0, expanded: 0 };
    const totalHeight = Math.max(viewportHeight - 18, 0);
    const collapsedVisibleHeight = Math.min(320, Math.max(268, viewportHeight * 0.29));
    const midVisibleHeight = Math.min(totalHeight - 24, Math.max(480, viewportHeight * 0.54));
    return {
      collapsed: Math.max(totalHeight - collapsedVisibleHeight, 0),
      mid: Math.max(totalHeight - midVisibleHeight, 0),
      expanded: 0,
    };
  }, [viewportHeight]);

  // Viewport / shell height tracking
  useEffect(() => {
    function update() {
      const visualHeight = window.visualViewport?.height ?? window.innerHeight;
      const layoutHeight = window.innerHeight;
      setShellHeight((prev) => Math.max(prev, layoutHeight));
      if (!baseViewportHeightRef.current || visualHeight > baseViewportHeightRef.current) {
        baseViewportHeightRef.current = visualHeight;
      }
      setViewportHeight(visualHeight);
    }
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  // Prevent body scroll
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, []);

  // Init sheet at mid snap once viewport is known
  useEffect(() => {
    if (!viewportHeight) return;
    setSheetOffset((current) => {
      if (current === null) return sheetSnaps.mid;
      return clamp(current, sheetSnaps.expanded, sheetSnaps.collapsed);
    });
  }, [sheetSnaps, viewportHeight]);

  // Load data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/public-share/${encodeURIComponent(token)}`);
        const json = await res.json().catch(() => ({})) as Partial<SharePayload> & { error?: string; details?: string };
        if (!res.ok) {
          setError(json.details ?? json.error ?? "This link is unavailable.");
          return;
        }
        setDisplayName(json.displayName ?? "Traveler");
        setPlaces(Array.isArray(json.places) ? json.places : []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  // Sheet drag handlers
  function handleSheetDragStart(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = { startY: event.clientY, startOffset: sheetOffset ?? sheetSnaps.mid };
    setSheetDragging(true);
  }

  function handleSheetDragMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    const delta = event.clientY - dragStateRef.current.startY;
    setSheetOffset(clamp(dragStateRef.current.startOffset + delta, sheetSnaps.expanded, sheetSnaps.collapsed));
  }

  function handleSheetDragEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setSheetDragging(false);
  }

  const mapViewportInsets = useMemo(() => ({
    topLeft: [20, 92] as [number, number],
    bottomRight: [20, 320] as [number, number],
  }), []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafbfc]">
        <p className="text-sm font-medium text-[#868c94]">Loading map…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#fafbfc] px-5">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111214] text-sm font-bold tracking-wide text-white">
          Ex
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-[#111214]">Link unavailable</h1>
          <p className="mt-2 max-w-xs text-sm leading-6 text-[#868c94]">
            {error}
          </p>
        </div>
        <Link
          href="/login"
          className="rounded-xl bg-[#111214] px-5 py-2.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition hover:bg-[#2a2d31]"
        >
          Open Explrd
        </Link>
      </div>
    );
  }

  const currentSheetOffset = viewportHeight && sheetOffset === null ? sheetSnaps.mid : (sheetOffset ?? 0);
  const visiblePanelHeight = sheetHeight - currentSheetOffset;
  const sheetStyle = {
    height: visiblePanelHeight ? `${visiblePanelHeight}px` : undefined,
    transition: sheetDragging ? "none" : "height 380ms cubic-bezier(0.32, 0.72, 0, 1)",
  } as const;
  const appShellStyle = shellHeight ? { height: `${shellHeight}px` } : undefined;

  return (
    <div className="relative overflow-hidden bg-[#fafbfc] text-[#111214]" style={appShellStyle}>
      {/* Map */}
      <div className="absolute inset-0">
        <PlacesMap
          places={places}
          mode="country"
          heightClassName="h-full"
          containerClassName="h-full w-full"
          theme="light"
          focusStrategy="data"
          viewportInsets={mapViewportInsets}
          defaultLayerView={["country"]}
        />
      </div>

      {/* Sheet */}
      <div className="pointer-events-none relative z-10 h-full px-2 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-[calc(env(safe-area-inset-top)+12px)] sm:px-4">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-2 pb-[calc(env(safe-area-inset-bottom)+6px)] sm:px-4">
          <section className="pointer-events-auto w-full max-w-[560px]">
            <div
              style={sheetStyle}
              className="relative overflow-hidden rounded-[28px] bg-white/85 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_16px_56px_rgba(0,0,0,0.12)] backdrop-blur-xl"
            >
              <div className="flex h-full flex-col">
                {/* Drag handle + header */}
                <div
                  onPointerDown={handleSheetDragStart}
                  onPointerMove={handleSheetDragMove}
                  onPointerUp={handleSheetDragEnd}
                  onPointerCancel={handleSheetDragEnd}
                  className="relative z-20 touch-none select-none px-5 pb-3 pt-3"
                >
                  <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-[#111214]/15" />
                  <div className="flex items-center justify-between gap-4">
                    <h1 className="text-[22px] font-bold tracking-[-0.04em] text-[#111214]">
                      {displayName}&apos;s Places
                    </h1>
                    <Link
                      href="/login"
                      onPointerDown={(e) => e.stopPropagation()}
                      className="shrink-0 rounded-full border border-[#e1e4e8] bg-white px-3.5 py-1.5 text-[12px] font-medium text-[#111214] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-[#f6f7f8]"
                    >
                      Open Explrd →
                    </Link>
                  </div>
                </div>

                {/* Content */}
                <div
                  ref={contentScrollRef}
                  className="flex-1 overflow-y-auto px-5 pb-4 pt-1"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  <section className="space-y-4">
                    {/* Mini stats card */}
                    <div className="overflow-hidden rounded-[28px] bg-[#0d1117]">
                      <div className="p-5">
                        <div className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#3a4d66]">
                          Explrd Passport
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
                          {[
                            { label: "Cities", value: stats.uniqueCities },
                            { label: "Countries", value: stats.uniqueCountries },
                            { label: "Continents", value: stats.uniqueContinents },
                            { label: "World Explored", value: `${stats.percentWorldTraveled}%` },
                          ].map(({ label, value }) => (
                            <div key={label}>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#3a4d66]">{label}</div>
                              <div className="mt-1 text-2xl font-bold tracking-tight text-white">{value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Hierarchy */}
                    {hierarchy.length === 0 ? (
                      <EmptyState
                        title="No places yet"
                        description="This map has no saved places yet."
                      />
                    ) : (
                      <div className="space-y-4">
                        {hierarchy.map((node) => (
                          <ContinentBlock key={node.continent} node={node} />
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
