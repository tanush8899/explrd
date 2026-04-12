"use client";

import { iso31661 } from "iso-3166";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAddressSearchDisplay,
  normalizeAddress,
} from "@/lib/exploration";
import { signOut } from "@/lib/auth";
import { getPlaceHierarchy, type ContinentNode } from "@/lib/journey";
import { getExplrdStats } from "@/lib/stats";
import type { ApiErrorResponse, SavedPlace, UserProfile } from "@/lib/types";
import { useSession } from "@/lib/use-session";

type Address = Record<string, string | number | boolean | null | undefined>;

type GeoResult = {
  place_id: string;
  display_name: string;
  lat: number;
  lng: number;
  address: Address;
};

type AppTab = "add" | "places" | "share";

const PlacesMap = dynamic(() => import("@/components/places-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#e8eef4]" />,
});

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" className="h-5 w-5">
      <path d="M12 5v14" strokeLinecap="round" />
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" className="h-5 w-5">
      <path d="M8 6h11" strokeLinecap="round" />
      <path d="M8 12h11" strokeLinecap="round" />
      <path d="M8 18h11" strokeLinecap="round" />
      <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" className="h-5 w-5">
      <path d="M12 4v11" strokeLinecap="round" />
      <path d="m8 8 4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 14v2.5A2.5 2.5 0 0 0 7.5 19h9a2.5 2.5 0 0 0 2.5-2.5V14" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
      <path d="M4 7h16" strokeLinecap="round" />
      <path d="M9.5 4h5" strokeLinecap="round" />
      <path d="M7 7v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7" />
      <path d="M10 11v5" strokeLinecap="round" />
      <path d="M14 11v5" strokeLinecap="round" />
    </svg>
  );
}

function getDisplayName(user: ReturnType<typeof useSession>["user"], profile: UserProfile | null) {
  if (profile?.display_name?.trim()) return profile.display_name.trim();

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

type SheetSnapPositions = {
  collapsed: number;
  mid: number;
  expanded: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getNearestSheetOffset(value: number, snaps: SheetSnapPositions) {
  return [snaps.collapsed, snaps.mid, snaps.expanded].reduce((closest, candidate) =>
    Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest
  );
}

function sanitizeTab(value: string | null): AppTab {
  if (value === "places" || value === "share") {
    return value;
  }

  return "add";
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[#e8eaed]">
      <div
        className="h-full rounded-full bg-[#111214]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function SummaryPill({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-[#e8eaed] bg-white px-3.5 py-3">
      <div className="text-[11px] uppercase tracking-[0.14em] text-[#868c94]">{label}</div>
      <div className="mt-1 text-lg font-semibold tracking-tight text-[#111214]">{value}</div>
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
  usa: "US",
  "united states": "US",
  "united states of america": "US",
  czechia: "CZ",
  "czech republic": "CZ",
  vietnam: "VN",
  "viet nam": "VN",
  russia: "RU",
  "russian federation": "RU",
};

function getCountryFlag(country: string) {
  const normalized = country.trim().toLowerCase();
  const iso2 = countryFlagOverrides[normalized] ?? countryNameToIso2.get(normalized);

  if (!iso2 || iso2.length !== 2) return null;

  return iso2
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

function BottomTab({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition ${
        active ? "bg-[#111214] text-white" : "text-[#868c94] hover:text-[#111214]"
      }`}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[28px] bg-[#f6f7f8] px-5 py-10 text-center text-[#8f9399]">
      <div className="text-2xl font-semibold tracking-tight text-[#7f8389]">{title}</div>
      <p className="mx-auto mt-3 max-w-md text-sm leading-7">{description}</p>
    </div>
  );
}

function ContinentBlock({
  node,
  deletingCityKey,
  onRemove,
}: {
  node: ContinentNode;
  deletingCityKey: string | null;
  onRemove: (cityKey: string, placeIds: string[]) => void;
}) {
  return (
    <section className="rounded-[30px] bg-[#f7f8f9] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-[#9aa0a6]">Continent</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-[#111214]">{node.continent}</div>
          <div className="mt-1 text-sm text-[#8c9198]">
            {node.exploredCountries}/{node.totalCountries} countries explored
          </div>
        </div>
        <div className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-[#111214]">
          {node.percentExplored}%
        </div>
      </div>

      <div className="mt-4">
        <ProgressBar value={node.percentExplored} />
      </div>

      <div className="mt-4 space-y-4">
        {node.countries.map((country) => (
          <div key={`${node.continent}-${country.country}`} className="rounded-[24px] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.04)]">
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
                        <div key={`${state.state ?? "no-state"}-${city.city}`} className="rounded-[18px] bg-white px-4 py-3">
                          {(() => {
                            const cityKey = [node.continent, country.country, state.state, city.city]
                              .filter(Boolean)
                              .join("|");

                            return (
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 text-base font-semibold tracking-tight text-[#111214]">
                                  {city.city}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onRemove(cityKey, city.places.map((place) => place.place_id))}
                                  disabled={deletingCityKey === cityKey}
                                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#f5c6c6] bg-[#fef2f2] px-3 py-1.5 text-xs font-medium text-[#b91c1c] transition hover:bg-[#fde8e8] disabled:opacity-50"
                                >
                                  <TrashIcon />
                                  {deletingCityKey === cityKey ? "Removing..." : "Delete"}
                                </button>
                              </div>
                            );
                          })()}
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

export default function Home() {
  const { loading: sessionLoading, session, user } = useSession();
  const [bootLoading, setBootLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("add");
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [selected, setSelected] = useState<GeoResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [deletingCityKey, setDeletingCityKey] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [sheetOffset, setSheetOffset] = useState<number | null>(null);
  const [sheetDragging, setSheetDragging] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const baseViewportHeightRef = useRef(0);
  const dragInputRef = useRef<"pointer" | "touch" | null>(null);
  const dragStateRef = useRef({
    startY: 0,
    startOffset: 0,
  });
  const pullGestureRef = useRef({
    startY: 0,
    active: false,
  });
  const canSearch = q.trim().length >= 2;

  useEffect(() => {
    setActiveTab(sanitizeTab(new URLSearchParams(window.location.search).get("tab")));
  }, []);

  const displayName = useMemo(() => getDisplayName(user, profile), [profile, user]);
  const initials = useMemo(() => getInitials(displayName), [displayName]);
  const stats = useMemo(() => getExplrdStats(savedPlaces), [savedPlaces]);
  const hierarchy = useMemo(() => getPlaceHierarchy(savedPlaces), [savedPlaces]);
  const selectedDisplay = useMemo(
    () => (selected ? getAddressSearchDisplay(selected.address, selected.display_name) : null),
    [selected]
  );
  const selectedNormalized = useMemo(
    () => (selected ? normalizeAddress(selected.address) : null),
    [selected]
  );
  const sheetHeight = useMemo(() => Math.max(viewportHeight - 18, 0), [viewportHeight]);
  const sheetSnaps = useMemo<SheetSnapPositions>(() => {
    if (!viewportHeight) {
      return {
        collapsed: 0,
        mid: 0,
        expanded: 0,
      };
    }

    const totalHeight = Math.max(viewportHeight - 18, 0);
    const collapsedVisibleHeight = Math.min(320, Math.max(268, viewportHeight * 0.29));
    const midVisibleHeight = Math.min(totalHeight - 24, Math.max(480, viewportHeight * 0.54));
    const expandedVisibleHeight = Math.min(totalHeight - 12, Math.max(700, viewportHeight * 0.84));

    return {
      collapsed: Math.max(totalHeight - collapsedVisibleHeight, 0),
      mid: Math.max(totalHeight - midVisibleHeight, 0),
      expanded: Math.max(totalHeight - expandedVisibleHeight, 0),
    };
  }, [viewportHeight]);

  useEffect(() => {
    function updateViewportHeight() {
      const nextHeight = window.innerHeight;

      if (!baseViewportHeightRef.current || nextHeight > baseViewportHeightRef.current) {
        baseViewportHeightRef.current = nextHeight;
      }

      const keyboardLikelyOpen = nextHeight < baseViewportHeightRef.current - 140;
      setKeyboardOpen(keyboardLikelyOpen);
      setViewportHeight(keyboardLikelyOpen ? baseViewportHeightRef.current : nextHeight);
    }

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);

    return () => window.removeEventListener("resize", updateViewportHeight);
  }, []);

  useEffect(() => {
    if (!viewportHeight) return;

    setSheetOffset((current) => {
      if (current === null) {
        return activeTab === "add" ? sheetSnaps.collapsed : sheetSnaps.mid;
      }
      return clamp(current, sheetSnaps.expanded, sheetSnaps.collapsed);
    });
  }, [activeTab, sheetSnaps, viewportHeight]);

  useEffect(() => {
    if (!viewportHeight || sheetDragging) return;

    setSheetOffset(activeTab === "add" ? sheetSnaps.collapsed : sheetSnaps.mid);
  }, [activeTab, sheetDragging, sheetSnaps.collapsed, sheetSnaps.mid, viewportHeight]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }

    if (!profileMenuOpen) return;

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [profileMenuOpen]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverscroll = html.style.overscrollBehavior;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      html.style.overscrollBehavior = previousHtmlOverscroll;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, []);

  const loadPage = useCallback(async () => {
    const token = session?.access_token;

    if (!token) {
      setProfile(null);
      setSavedPlaces([]);
      setPageError("Sign in to load your places.");
      return;
    }

    try {
      const [placesRes, profileRes] = await Promise.all([
        fetch("/api/my-places", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch("/api/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      const placesOut = (await placesRes.json().catch(() => ({}))) as ApiErrorResponse & {
        places?: SavedPlace[];
      };
      const profileOut = (await profileRes.json().catch(() => ({}))) as ApiErrorResponse & {
        profile?: UserProfile;
      };

      if (!placesRes.ok) {
        setSavedPlaces([]);
        setPageError(placesOut.details ?? placesOut.error ?? "Could not load places.");
        return;
      }

      setSavedPlaces(Array.isArray(placesOut.places) ? placesOut.places : []);
      setProfile(profileOut.profile ?? null);
      setPageError(null);
    } catch (error: unknown) {
      setSavedPlaces([]);
      setPageError(
        error instanceof Error ? `Could not load your map: ${error.message}` : "Could not load your map."
      );
    }
  }, [session]);

  useEffect(() => {
    if (sessionLoading) return;

    if (!user || !session?.access_token) {
      window.location.replace("/login");
      return;
    }

    async function boot() {
      setBootLoading(true);
      await loadPage();
      setBootLoading(false);
    }

    boot();
  }, [loadPage, session, sessionLoading, user]);

  useEffect(() => {
    setSearchError(null);

    if (!canSearch) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);

      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q.trim())}`, {
          signal: controller.signal,
        });
        const out = (await res.json().catch(() => ({}))) as {
          results?: GeoResult[];
          error?: string;
          details?: string;
        };

        if (!res.ok) {
          setResults([]);
          setSearchError(out.details ?? out.error ?? "Search is unavailable right now.");
          return;
        }

        setResults(Array.isArray(out.results) ? out.results : []);
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setResults([]);
          setSearchError(error instanceof Error ? error.message : "Search is unavailable right now.");
        }
      } finally {
        setSearching(false);
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [canSearch, q]);

  function resetComposer() {
    setSelected(null);
    setResults([]);
    setQ("");
    setSearchError(null);
  }

  function pickResult(result: GeoResult) {
    setSelected(result);
    setResults([]);
    setQ(result.display_name);
    setSaveMsg(null);
  }

  async function saveSelected() {
    if (!selected) return;

    setSaving(true);
    setSaveMsg(null);
    setPageError(null);

    try {
      const token = session?.access_token;

      if (!token) {
        setSaveMsg("Sign in again to save this place.");
        return;
      }

      const res = await fetch("/api/pins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          place_id: selected.place_id,
          display_name: selected.display_name,
          lat: selected.lat,
          lng: selected.lng,
          address: selected.address,
        }),
      });

      const out = (await res.json().catch(() => ({}))) as ApiErrorResponse;

      if (!res.ok) {
        setSaveMsg(out.details ?? out.error ?? "Could not save place.");
        return;
      }

      await loadPage();
      resetComposer();
      setSaveMsg("Added to your places.");
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setActiveTab("places");
    } catch (error: unknown) {
      setSaveMsg(error instanceof Error ? error.message : "Could not save place.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCity(cityKey: string, placeIds: string[]) {
    setDeletingCityKey(cityKey);
    setPageError(null);
    setSaveMsg(null);

    try {
      const token = session?.access_token;

      if (!token) {
        setPageError("Sign in again to remove a place.");
        return;
      }

      const deletionResults = await Promise.all(
        placeIds.map(async (placeId) => {
          const res = await fetch(`/api/pins/${encodeURIComponent(placeId)}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const out = (await res.json().catch(() => ({}))) as ApiErrorResponse;
          return { ok: res.ok, out, placeId };
        })
      );

      const failedDeletion = deletionResults.find((result) => !result.ok);
      if (failedDeletion) {
        setPageError(failedDeletion.out.details ?? failedDeletion.out.error ?? "Could not remove city.");
        return;
      }

      const deletedIds = new Set(placeIds);
      setSavedPlaces((current) => current.filter((place) => !deletedIds.has(place.place_id)));
    } catch (error: unknown) {
      setPageError(error instanceof Error ? error.message : "Could not remove city.");
    } finally {
      setDeletingCityKey(null);
    }
  }

  async function handleLogOut() {
    try {
      setLoggingOut(true);
      await signOut();
      window.location.replace("/login");
    } catch (error: unknown) {
      setPageError(error instanceof Error ? error.message : "Could not log out.");
    } finally {
      setLoggingOut(false);
      setProfileMenuOpen(false);
    }
  }

  function handleSheetDragStart(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    dragInputRef.current = "pointer";
    dragStateRef.current = {
      startY: event.clientY,
      startOffset: sheetOffset ?? sheetSnaps.collapsed,
    };
    setSheetDragging(true);
  }

  function handleSheetTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    dragInputRef.current = "touch";
    dragStateRef.current = {
      startY: event.touches[0]?.clientY ?? 0,
      startOffset: sheetOffset ?? sheetSnaps.collapsed,
    };
    setSheetDragging(true);
  }

  useEffect(() => {
    if (!sheetDragging) return;

    function handlePointerMove(event: PointerEvent) {
      if (dragInputRef.current !== "pointer") return;

      event.preventDefault();

      const delta = event.clientY - dragStateRef.current.startY;
      setSheetOffset(
        clamp(
          dragStateRef.current.startOffset + delta,
          sheetSnaps.expanded,
          sheetSnaps.collapsed
        )
      );
    }

    function handlePointerEnd() {
      if (dragInputRef.current !== "pointer") return;

      dragInputRef.current = null;
      setSheetDragging(false);
      setSheetOffset((current) => getNearestSheetOffset(current ?? sheetSnaps.collapsed, sheetSnaps));
    }

    function handleTouchMove(event: TouchEvent) {
      if (dragInputRef.current !== "touch") return;

      event.preventDefault();
      const currentY = event.touches[0]?.clientY ?? dragStateRef.current.startY;
      const delta = currentY - dragStateRef.current.startY;

      setSheetOffset(
        clamp(
          dragStateRef.current.startOffset + delta,
          sheetSnaps.expanded,
          sheetSnaps.collapsed
        )
      );
    }

    function handleTouchEnd() {
      if (dragInputRef.current !== "touch") return;

      dragInputRef.current = null;
      setSheetDragging(false);
      setSheetOffset((current) => getNearestSheetOffset(current ?? sheetSnaps.collapsed, sheetSnaps));
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [sheetDragging, sheetSnaps]);

  function handleSheetContentScroll(event: React.UIEvent<HTMLDivElement>) {
    const scrollTop = event.currentTarget.scrollTop;
    const currentOffset =
      sheetOffset ?? (activeTab === "add" ? sheetSnaps.collapsed : sheetSnaps.mid);

    if (scrollTop > 180 && currentOffset > sheetSnaps.expanded + 8) {
      setSheetOffset(sheetSnaps.expanded);
      return;
    }

    if (scrollTop > 40 && currentOffset > sheetSnaps.mid + 8) {
      setSheetOffset(sheetSnaps.mid);
    }
  }

  function shrinkSheetOneLevel() {
    setSheetOffset((current) => {
      const currentOffset =
        current ?? (activeTab === "add" ? sheetSnaps.collapsed : sheetSnaps.mid);

      if (currentOffset <= sheetSnaps.expanded + 8) {
        return sheetSnaps.mid;
      }

      if (currentOffset <= sheetSnaps.mid + 8) {
        return sheetSnaps.collapsed;
      }

      return currentOffset;
    });
  }

  function handleSheetContentTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    pullGestureRef.current = {
      startY: event.touches[0]?.clientY ?? 0,
      active: true,
    };
  }

  function handleSheetContentTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (!pullGestureRef.current.active) return;
    if ((contentScrollRef.current?.scrollTop ?? 0) > 0) return;

    const currentY = event.touches[0]?.clientY ?? 0;
    const deltaY = currentY - pullGestureRef.current.startY;

    if (deltaY > 32) {
      shrinkSheetOneLevel();
      pullGestureRef.current = {
        startY: currentY,
        active: false,
      };
    }
  }

  function handleSheetContentTouchEnd() {
    pullGestureRef.current.active = false;
  }

  function expandSheetFully() {
    setSheetOffset(sheetSnaps.expanded);
  }

  if (sessionLoading || bootLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafbfc] px-6">
        <p className="text-sm font-medium text-[#868c94]">Loading Explrd...</p>
      </div>
    );
  }

  const currentSheetOffset =
    viewportHeight && sheetOffset === null ? sheetSnaps.collapsed : (sheetOffset ?? 0);
  const visiblePanelHeight = sheetHeight - currentSheetOffset;
  const sheetStyle = {
    height: visiblePanelHeight ? `${visiblePanelHeight}px` : undefined,
    bottom: keyboardOpen ? "0px" : undefined,
    transition: sheetDragging ? "none" : "height 280ms cubic-bezier(0.22, 1, 0.36, 1)",
  } as const;
  const mapViewportInsets = {
    topLeft: [20, 92] as [number, number],
    bottomRight: [20, Math.round(visiblePanelHeight) + 28] as [number, number],
  };
  const appShellStyle = viewportHeight ? { height: `${viewportHeight}px` } : undefined;

  return (
    <div className="relative overflow-hidden bg-[#fafbfc] text-[#111214]" style={appShellStyle}>
      <div className="absolute inset-0">
        <PlacesMap
          places={savedPlaces}
          mode="country"
          heightClassName="h-full"
          containerClassName="h-full w-full"
          theme="light"
          focusStrategy="world"
          viewportInsets={mapViewportInsets}
        />
      </div>

      <div className="pointer-events-none relative z-10 h-full px-2 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-[calc(env(safe-area-inset-top)+12px)] sm:px-4">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-2 pb-[calc(env(safe-area-inset-bottom)+6px)] sm:px-4">
          <section className="pointer-events-auto w-full max-w-[560px]">
            <div
              style={sheetStyle}
              className="relative overflow-hidden rounded-[28px] bg-white/85 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_16px_56px_rgba(0,0,0,0.12)] backdrop-blur-xl"
            >
              <div className="flex h-full flex-col">
                <div
                  onPointerDown={handleSheetDragStart}
                  onTouchStart={handleSheetTouchStart}
                  className="relative z-20 touch-none select-none px-5 pb-2 pt-2.5"
                >
                  <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[#111214]/12" />
                  <div className="flex items-center justify-between gap-4">
                    <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#111214]">
                      {activeTab === "add" ? "Add a Place" : activeTab === "places" ? "My Places" : "Share"}
                    </h1>

                    <div
                      ref={profileMenuRef}
                      onPointerDown={(event) => event.stopPropagation()}
                      className="relative z-30 shrink-0"
                    >
                      <button
                        type="button"
                        onClick={() => setProfileMenuOpen((current) => !current)}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111214] text-xs font-semibold text-white"
                        aria-label="Open profile menu"
                        aria-expanded={profileMenuOpen}
                      >
                        {initials}
                      </button>

                      {profileMenuOpen ? (
                        <div className="absolute right-0 top-[calc(100%+8px)] w-[160px] rounded-xl bg-white p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] ring-1 ring-black/5">
                          <button
                            type="button"
                            onClick={handleLogOut}
                            disabled={loggingOut}
                            className="flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-[#111214] transition hover:bg-[#f4f5f6] disabled:opacity-50"
                          >
                            {loggingOut ? "Logging out..." : "Log out"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div
                  ref={contentScrollRef}
                  className="flex-1 overflow-y-auto px-5 pb-4 pt-2"
                  onScroll={handleSheetContentScroll}
                  onTouchEnd={handleSheetContentTouchEnd}
                  onTouchMove={handleSheetContentTouchMove}
                  onTouchStart={handleSheetContentTouchStart}
                >
                  {pageError ? (
                    <div className="rounded-xl border border-[#f5c6c6] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">{pageError}</div>
                  ) : null}

                  {activeTab === "add" ? (
                    <section className="space-y-4">
                      <div className="relative">
                        <label className="flex items-center gap-3 rounded-xl border border-[#e1e4e8] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                          <SearchIcon />
                          <input
                            value={q}
                            onChange={(event) => {
                              setQ(event.target.value);
                              setSelected(null);
                              setSaveMsg(null);
                            }}
                            onFocus={expandSheetFully}
                            placeholder="Search for city"
                            className="w-full bg-transparent text-base text-[#111214] outline-none"
                          />
                          {searching ? <span className="text-xs text-[#9aa0a6]">Searching...</span> : null}
                        </label>

                        {results.length > 0 ? (
                          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.1)] ring-1 ring-black/5">
                            {results.map((result) => {
                              const preview = getAddressSearchDisplay(result.address, result.display_name);

                              return (
                                <button
                                  key={result.place_id}
                                  type="button"
                                  onClick={() => pickResult(result)}
                                  className="w-full border-b border-[#f0f1f3] px-4 py-4 text-left last:border-b-0 hover:bg-[#fafafa]"
                                >
                                  <div className="text-sm font-semibold text-[#111214]">{preview.title}</div>
                                  <div className="mt-1 text-xs text-[#8f949a]">{preview.subtitle}</div>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>

                      {searchError ? <div className="rounded-xl border border-[#f5c6c6] bg-[#fef2f2] px-3.5 py-3 text-sm text-[#b91c1c]">{searchError}</div> : null}

                      {selected && selectedDisplay && selectedNormalized ? (
                        <div className="rounded-[28px] bg-[#f6f7f8] p-4">
                          <div className="text-2xl font-semibold tracking-tight text-[#111214]">
                            {selectedDisplay.title}
                          </div>
                          <div className="mt-1 text-sm text-[#8a9096]">{selectedDisplay.subtitle}</div>

                          <div className="mt-3 flex flex-wrap gap-2 text-sm text-[#7f848b]">
                            {selectedNormalized.normalized_state ? (
                              <div className="rounded-full bg-white px-3 py-2">{selectedNormalized.normalized_state}</div>
                            ) : null}
                            {selectedNormalized.normalized_country ? (
                              <div className="rounded-full bg-white px-3 py-2">{selectedNormalized.normalized_country}</div>
                            ) : null}
                            {selectedNormalized.normalized_continent ? (
                              <div className="rounded-full bg-white px-3 py-2">{selectedNormalized.normalized_continent}</div>
                            ) : null}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={saveSelected}
                              disabled={saving}
                              className="inline-flex items-center gap-2 rounded-xl bg-[#111214] px-5 py-3 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition hover:bg-[#2a2d31] disabled:opacity-40"
                            >
                              <PlusIcon />
                              {saving ? "Adding..." : "Add place"}
                            </button>
                            <button
                              type="button"
                              onClick={resetComposer}
                              className="rounded-xl border border-[#e1e4e8] bg-white px-5 py-3 text-sm font-medium text-[#3d4249] transition hover:bg-[#f8f9fa]"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="h-6" />
                      )}

                      {saveMsg ? <div className="text-sm text-[#5c6167]">{saveMsg}</div> : null}
                    </section>
                  ) : null}

                  {activeTab === "places" ? (
                    <section className="space-y-4">
                      <div className="rounded-[30px] bg-[#f6f7f8] p-4">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-[#9ca1a8]">Summary</div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <SummaryPill label="Explrd score" value={stats.score} />
                          <SummaryPill label="Cities" value={stats.uniqueCities} />
                          <SummaryPill label="Countries" value={stats.uniqueCountries} />
                          <SummaryPill label="Continents" value={stats.uniqueContinents} />
                        </div>
                      </div>

                      {hierarchy.length === 0 ? (
                        <EmptyState
                          title="No places yet"
                          description="Once you add places, they will be organized by continent, country, state, and city here."
                        />
                      ) : (
                        <div className="space-y-4">
                          {hierarchy.map((node) => (
                            <ContinentBlock
                              key={node.continent}
                              node={node}
                              deletingCityKey={deletingCityKey}
                              onRemove={removeCity}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  ) : null}

                  {activeTab === "share" ? (
                    <section className="space-y-4">
                      <div className="rounded-[30px] bg-[#f6f7f8] p-5">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-[#9ca1a8]">Share</div>
                        <div className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#111214]">
                          Share with friends
                        </div>
                        <p className="mt-3 text-sm leading-7 text-[#8c9198]">
                          This will stay very simple. A clean share flow is coming next.
                        </p>
                      </div>

                      <EmptyState
                        title="To Be Developed"
                        description="The share tab is intentionally minimal for now. We’ll keep it focused on one clean public profile experience."
                      />

                      <div className="rounded-[28px] bg-[#f6f7f8] p-4 text-sm leading-7 text-[#7f848b]">
                        Current snapshot: {stats.totalPlaces} places across {stats.uniqueCountries} countries and{" "}
                        {stats.uniqueContinents} continents.
                      </div>
                    </section>
                  ) : null}
                </div>

                <div className="px-4 pb-4 pt-1">
                  <div className="flex items-stretch gap-1.5 rounded-2xl bg-[#f4f5f6] p-1.5">
                    <BottomTab
                      active={activeTab === "add"}
                      icon={<PlusIcon />}
                      label="Add Place"
                      onClick={() => setActiveTab("add")}
                    />
                    <BottomTab
                      active={activeTab === "places"}
                      icon={<ListIcon />}
                      label="My Places"
                      onClick={() => setActiveTab("places")}
                    />
                    <BottomTab
                      active={activeTab === "share"}
                      icon={<ShareIcon />}
                      label="Share"
                      onClick={() => setActiveTab("share")}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
