"use client";

import { iso31661 } from "iso-3166";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAddressSearchDisplay,
  getSavableLocality,
  normalizeAddress,
} from "@/lib/exploration";
import { signOut } from "@/lib/auth";
import { getPlaceHierarchy, type ContinentNode } from "@/lib/journey";
import { getExplrdStats } from "@/lib/stats";
import type { ApiErrorResponse, SavedPlace, UserProfile } from "@/lib/types";
import { useSession } from "@/lib/use-session";
import { PassportCard } from "@/components/share-card";

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

function QuickAddIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" className="h-4.5 w-4.5">
      <path d="M12 5v14" strokeLinecap="round" />
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="m3.5 8.5 2.5 2.5 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="m7 7 10 10" strokeLinecap="round" />
      <path d="M17 7 7 17" strokeLinecap="round" />
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

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
      <path d="M10 13.5 14 9.5" strokeLinecap="round" />
      <path d="M7.5 14.5 5.8 16.2a3.2 3.2 0 1 0 4.5 4.5l1.7-1.7" strokeLinecap="round" />
      <path d="m16.5 9.5 1.7-1.7a3.2 3.2 0 1 0-4.5-4.5l-1.7 1.7" strokeLinecap="round" />
    </svg>
  );
}

function PassportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <path d="M9 7h6" strokeLinecap="round" />
      <circle cx="12" cy="13" r="2.5" />
      <path d="M12 10.5v5" strokeLinecap="round" />
      <path d="M9.5 13h5" strokeLinecap="round" />
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

function getProfileImageUrl(user: ReturnType<typeof useSession>["user"]) {
  const candidates = [
    typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
    typeof user?.user_metadata?.picture === "string" ? user.user_metadata.picture : null,
  ];

  const firstValid = candidates.find((candidate) => typeof candidate === "string" && candidate.trim().length > 0);
  return firstValid?.trim() ?? null;
}

type SheetSnapPositions = {
  collapsed: number;
  mid: number;
  expanded: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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
  usa: "US",
  "united states": "US",
  "united states of america": "US",
  uk: "GB",
  "united kingdom": "GB",
  "great britain": "GB",
  "united kingdom of great britain and northern ireland": "GB",
  czechia: "CZ",
  "czech republic": "CZ",
  vietnam: "VN",
  "viet nam": "VN",
  russia: "RU",
  "russian federation": "RU",
  bolivia: "BO",
  "bolivia (plurinational state of)": "BO",
  tanzania: "TZ",
  "tanzania, united republic of": "TZ",
  "united republic of tanzania": "TZ",
  iran: "IR",
  "iran (islamic republic of)": "IR",
  moldova: "MD",
  "republic of moldova": "MD",
  venezuela: "VE",
  "venezuela (bolivarian republic of)": "VE",
  syria: "SY",
  "syrian arab republic": "SY",
  laos: "LA",
  "lao pdr": "LA",
  "lao people's democratic republic": "LA",
  brunei: "BN",
  "brunei darussalam": "BN",
  macedonia: "MK",
  "north macedonia": "MK",
  "korea, republic of": "KR",
  "south korea": "KR",
  "korea, democratic people's republic of": "KP",
  "north korea": "KP",
};

function getSearchResultDisplay(
  address: Record<string, string | number | boolean | null | undefined>,
  displayName: string
) {
  const { normalized_city, normalized_state, normalized_country } = normalizeAddress(address);

  const title =
    normalized_city ??
    normalized_state ??
    normalized_country ??
    displayName.split(",")[0]?.trim() ??
    displayName;

  const contextParts = [normalized_state, normalized_country].filter(
    (part, index, values): part is string => Boolean(part) && values.indexOf(part) === index
  );

  return {
    title,
    context: contextParts.join(", ") || null,
  };
}

function getOptimisticSavedPlace(result: GeoResult): SavedPlace {
  const normalized = getSavableLocality(result.address);
  const stablePlaceId = normalized.city
    ? `city:${[normalized.city, normalized.state, normalized.country]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.trim().toLowerCase())
        .join("|")}`
    : result.place_id;

  return {
    place_id: stablePlaceId,
    name: result.display_name,
    city: normalized.city,
    state: normalized.state,
    country: normalized.country,
    continent: normalized.continent,
    normalized_city: normalized.normalized_city,
    normalized_state: normalized.normalized_state,
    normalized_country: normalized.normalized_country,
    normalized_continent: normalized.normalized_continent,
    lat: result.lat,
    lng: result.lng,
    formatted: result.display_name,
    city_boundary: null,
    state_boundary: null,
    country_boundary: null,
    continent_boundary: null,
  };
}

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
      className={`flex min-w-0 flex-1 items-center justify-center rounded-[14px] px-2 py-3 transition ${
        active ? "bg-[#111214] text-white shadow-[0_1px_3px_rgba(0,0,0,0.18)]" : "text-[#868c94] hover:text-[#111214]"
      }`}
    >
      <span>{icon}</span>
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
    <div className="rounded-[28px] border border-dashed border-[#dfe2e6] bg-[#f7f8f9] px-5 py-10 text-center">
      <div className="text-base font-semibold tracking-tight text-[#7f8389]">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#9aa0a6]">{description}</p>
    </div>
  );
}

function ContinentBlock({
  node,
  deletingCityKey,
  onRequestRemove,
}: {
  node: ContinentNode;
  deletingCityKey: string | null;
  onRequestRemove: (cityKey: string, cityName: string, placeIds: string[]) => void;
}) {
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
                                  onClick={() =>
                                    onRequestRemove(cityKey, city.city, city.places.map((place) => place.place_id))
                                  }
                                  disabled={deletingCityKey === cityKey}
                                  aria-label={deletingCityKey === cityKey ? "Removing city" : "Delete city"}
                                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#e6e9ed] bg-white px-3 py-1.5 text-xs font-medium text-[#7f8790] transition hover:border-[#d5dbe1] hover:bg-[#f8f9fa] hover:text-[#58606a] disabled:opacity-50"
                                >
                                  <TrashIcon />
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

// ─── ShareTab ──────────────────────────────────────────────────────────────

type ShareTabProps = {
  displayName: string;
  stats: ReturnType<typeof getExplrdStats>;
  session: import("@supabase/supabase-js").Session | null;
};

type ShareMode = "passport" | "link";

function ShareTab({ displayName, stats, session }: ShareTabProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [shareMode, setShareMode] = useState<ShareMode>("passport");
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [linkExpiry, setLinkExpiry] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [copied, setCopied] = useState<"link" | null>(null);

  async function handleSaveImage() {
    if (!cardRef.current) return;
    setSavingImage(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
        logging: false,
      });
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) return;

      const file = new File([blob], "explrd-passport.png", { type: "image/png" });

      if (navigator.share) {
        try {
          await navigator.share({
            files: [file],
            title: `${displayName}'s Explrd Passport`,
          });
          return;
        } catch (err) {
          // User cancelled — don't fall through to download
          if (err instanceof Error && err.name === "AbortError") return;
          // Share failed (e.g. file sharing not supported) — fall through to download
        }
      }

      // Fallback: download the image
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "explrd-passport.png";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setSavingImage(false);
    }
  }

  async function handleGenerateLink() {
    if (!session) return;
    setGeneratingLink(true);
    try {
      const res = await fetch("/api/share-link", {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json() as { token?: string; expiresAt?: string };
      if (json.token) {
        const url = `${window.location.origin}/s/${json.token}`;
        setShareLink(url);
        setLinkExpiry(json.expiresAt ?? null);
      }
    } finally {
      setGeneratingLink(false);
    }
  }

  async function handleCopyLink() {
    if (!shareLink) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareLink);
      } else {
        // Fallback for mobile Safari
        const el = document.createElement("textarea");
        el.value = shareLink;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied("link");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // If all else fails, do nothing silently
    }
  }

  const expiryLabel = linkExpiry
    ? (() => {
        const diff = Math.ceil((new Date(linkExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return diff <= 0 ? "Expired" : diff === 1 ? "Expires tomorrow" : `Expires in ${diff} days`;
      })()
    : null;

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setShareMode("passport")}
          className={`rounded-[24px] border px-4 py-4 text-left transition ${
            shareMode === "passport"
              ? "border-[#111214] bg-[#111214] text-white shadow-[0_14px_40px_rgba(17,18,20,0.2)]"
              : "border-[#e1e4e8] bg-white text-[#111214] hover:bg-[#f8f9fa]"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <PassportIcon />
            <div className="text-sm font-semibold tracking-tight">Share Explrd Passport</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setShareMode("link")}
          className={`rounded-[24px] border px-4 py-4 text-left transition ${
            shareMode === "link"
              ? "border-[#111214] bg-[#111214] text-white shadow-[0_14px_40px_rgba(17,18,20,0.2)]"
              : "border-[#e1e4e8] bg-white text-[#111214] hover:bg-[#f8f9fa]"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <LinkIcon />
            <div className="text-sm font-semibold tracking-tight">Share Link</div>
          </div>
        </button>
      </div>

      {shareMode === "passport" ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleSaveImage}
            disabled={savingImage}
            className="w-full rounded-[24px] bg-[#111214] px-5 py-4 text-base font-semibold text-white shadow-[0_18px_44px_rgba(17,18,20,0.18)] transition hover:bg-[#2a2d31] disabled:opacity-50"
          >
            {savingImage ? "Preparing…" : "Share Explrd Passport"}
          </button>
          <PassportCard displayName={displayName} stats={stats} cardRef={cardRef} />
        </div>
      ) : (
        <div className="rounded-[28px] border border-[#e1e4e8] bg-white px-5 py-5 shadow-[0_18px_44px_rgba(17,18,20,0.08)]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9ca1a8]">
            Explrd Link
          </div>
          <div className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-[#111214]">
            Share your map
          </div>
          <p className="mt-2 text-[13px] leading-5 text-[#868c94]">
            Anyone with the link can browse your visited places. No sign-in required. Expires in 7 days.
          </p>

          {shareLink ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 overflow-hidden rounded-2xl border border-[#e8eaed] bg-[#fafbfc] px-3 py-3">
                <span className="flex-1 truncate text-[12px] font-medium text-[#3d4249]">{shareLink}</span>
                {expiryLabel ? <span className="shrink-0 text-[10px] text-[#9ca1a8]">{expiryLabel}</span> : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="rounded-xl bg-[#111214] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#2a2d31]"
                >
                  {copied === "link" ? "Copied!" : "Copy Link"}
                </button>
                <button
                  type="button"
                  onClick={handleGenerateLink}
                  disabled={generatingLink}
                  className="rounded-xl border border-[#e1e4e8] bg-white px-4 py-3 text-sm font-medium text-[#111214] transition hover:bg-[#f6f7f8] disabled:opacity-50"
                >
                  {generatingLink ? "Refreshing…" : "Refresh Link"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGenerateLink}
              disabled={generatingLink}
              className="mt-4 w-full rounded-xl bg-[#111214] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#2a2d31] disabled:opacity-50"
            >
              {generatingLink ? "Generating…" : "Generate Link"}
            </button>
          )}
        </div>
      )}
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [selected, setSelected] = useState<GeoResult | null>(null);
  const [quickAddedSpotlight, setQuickAddedSpotlight] = useState<GeoResult | null>(null);
  const [quickToastLabel, setQuickToastLabel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [quickAddingPlaceId, setQuickAddingPlaceId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [deletingCityKey, setDeletingCityKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    cityKey: string;
    cityName: string;
    placeIds: string[];
  } | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mapViewportResetKey, setMapViewportResetKey] = useState(0);
  const [shellHeight, setShellHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [sheetOffset, setSheetOffset] = useState<number | null>(null);
  const [sheetDragging, setSheetDragging] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const bootedTokenRef = useRef<string | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const baseViewportHeightRef = useRef(0);
  const dragStateRef = useRef({ startY: 0, startOffset: 0 });
  const pendingAddRestingResetRef = useRef(false);
  const quickToastTimeoutRef = useRef<number | null>(null);
  const trimmedQuery = q.trim();
  const canSearch = trimmedQuery.length >= 2;

  function showQuickToast(label: string) {
    if (quickToastTimeoutRef.current) {
      window.clearTimeout(quickToastTimeoutRef.current);
    }
    setQuickToastLabel(`Added ${label}`);
    quickToastTimeoutRef.current = window.setTimeout(() => {
      setQuickToastLabel(null);
      quickToastTimeoutRef.current = null;
    }, 1800);
  }

  useEffect(() => {
    setActiveTab(sanitizeTab(new URLSearchParams(window.location.search).get("tab")));
  }, []);

  const displayName = useMemo(() => getDisplayName(user, profile), [profile, user]);
  const initials = useMemo(() => getInitials(displayName), [displayName]);
  const profileImageUrl = useMemo(() => getProfileImageUrl(user), [user]);
  const stats = useMemo(() => getExplrdStats(savedPlaces), [savedPlaces]);
  const hierarchy = useMemo(() => getPlaceHierarchy(savedPlaces), [savedPlaces]);
  const savedPlaceIds = useMemo(() => new Set(savedPlaces.map((place) => place.place_id)), [savedPlaces]);
  const selectedDisplay = useMemo(
    () => (selected ? getAddressSearchDisplay(selected.address, selected.display_name) : null),
    [selected]
  );
  const searchExperienceOpen = activeTab === "add" && searchOpen;
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

    return {
      collapsed: Math.max(totalHeight - collapsedVisibleHeight, 0),
      mid: Math.max(totalHeight - midVisibleHeight, 0),
      expanded: 0,
    };
  }, [viewportHeight]);

  useEffect(() => {
    function updateViewportHeight() {
      // visualViewport.height fires on iOS when keyboard opens; window.innerHeight does not
      const visualHeight = window.visualViewport?.height ?? window.innerHeight;
      const layoutHeight = window.innerHeight;

      // Shell always uses the full layout height so the map never jumps
      setShellHeight((prev) => Math.max(prev, layoutHeight));

      // Track the max visual height seen (= no-keyboard state)
      if (!baseViewportHeightRef.current || visualHeight > baseViewportHeightRef.current) {
        baseViewportHeightRef.current = visualHeight;
      }

      const keyboardLikelyOpen = visualHeight < baseViewportHeightRef.current - 140;
      setKeyboardOpen(keyboardLikelyOpen);
      // viewportHeight drives sheet snap calculations — shrinks with keyboard
      setViewportHeight(visualHeight);
    }

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    window.visualViewport?.addEventListener("resize", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.visualViewport?.removeEventListener("resize", updateViewportHeight);
    };
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
    if (!pendingAddRestingResetRef.current || keyboardOpen || activeTab !== "add") return;

    setSheetOffset(sheetSnaps.collapsed);
    pendingAddRestingResetRef.current = false;
  }, [activeTab, keyboardOpen, sheetSnaps.collapsed]);

  useEffect(() => {
    if (activeTab === "add") return;

    abortRef.current?.abort();
    setSearching(false);
    setSearchOpen(false);
    searchInputRef.current?.blur();
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (quickToastTimeoutRef.current) {
        window.clearTimeout(quickToastTimeoutRef.current);
      }
    };
  }, []);

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

  const accessToken = session?.access_token ?? null;

  const loadPage = useCallback(async () => {
    if (!accessToken) {
      setProfile(null);
      setSavedPlaces([]);
      setPageError("Sign in to load your places.");
      return;
    }

    try {
      const [placesRes, profileRes] = await Promise.all([
        fetch("/api/my-places", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        fetch("/api/profile", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
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
  }, [accessToken]);

  useEffect(() => {
    if (sessionLoading) return;

    if (!user || !accessToken) {
      window.location.replace("/login");
      return;
    }

    // Prevent duplicate boots when Supabase fires multiple auth events
    // with new session object references but the same token
    if (bootedTokenRef.current === accessToken) return;
    bootedTokenRef.current = accessToken;

    async function boot() {
      setBootLoading(true);
      try {
        await loadPage();
      } finally {
        setBootLoading(false);
      }
    }

    boot();
  }, [accessToken, loadPage, sessionLoading, user]);

  useEffect(() => {
    setSearchError(null);

    if (!canSearch) {
      abortRef.current?.abort();
      setResults([]);
      setSearching(false);
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

  function dismissSearchExperience() {
    setSelected(null);
    setQuickAddedSpotlight(null);
    setResults([]);
    setQ("");
    setSearchError(null);
    setSaveMsg(null);
    setSearching(false);
    abortRef.current?.abort();
    setSearchOpen(false);
    pendingAddRestingResetRef.current = true;
    searchInputRef.current?.blur();
  }

  function clearSearchInput() {
    setQ("");
    setResults([]);
    setSelected(null);
    setQuickAddedSpotlight(null);
    setSearchError(null);
    setSaveMsg(null);
    setSearching(false);
    abortRef.current?.abort();
    searchInputRef.current?.focus();
  }

  function resetComposer() {
    setSelected(null);
    setQuickAddedSpotlight(null);
    setResults([]);
    setQ("");
    setSearchError(null);
    setSearchOpen(false);
    setSearching(false);
    abortRef.current?.abort();
    searchInputRef.current?.blur();
  }

  function pickResult(result: GeoResult) {
    const display = getSearchResultDisplay(result.address, result.display_name);

    setQuickAddedSpotlight(null);
    setSelected(result);
    setResults([]);
    setQ(display.title);
    setSaveMsg(null);
    setSearchError(null);
    setSearchOpen(false);
    setSearching(false);
    pendingAddRestingResetRef.current = true;
    abortRef.current?.abort();
    searchInputRef.current?.blur();
  }

  async function persistPlace(result: GeoResult) {
    const token = session?.access_token;

    if (!token) {
      throw new Error("Sign in again to save this place.");
    }

    const res = await fetch("/api/pins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        place_id: result.place_id,
        display_name: result.display_name,
        lat: result.lat,
        lng: result.lng,
        address: result.address,
      }),
    });

    const out = (await res.json().catch(() => ({}))) as ApiErrorResponse;

    if (!res.ok) {
      throw new Error(out.details ?? out.error ?? "Could not save place.");
    }
  }

  async function saveSelected() {
    if (!selected) return;

    setSaving(true);
    setSaveMsg(null);
    setPageError(null);
    const optimisticPlace = getOptimisticSavedPlace(selected);

    setSavedPlaces((current) =>
      current.some((place) => place.place_id === optimisticPlace.place_id) ? current : [optimisticPlace, ...current]
    );

    try {
      await persistPlace(selected);
      resetComposer();
      setSaveMsg("Added to your places.");
      void loadPage();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    } catch (error: unknown) {
      setSavedPlaces((current) => current.filter((place) => place.place_id !== optimisticPlace.place_id));
      setSaveMsg(error instanceof Error ? error.message : "Could not save place.");
    } finally {
      setSaving(false);
    }
  }

  async function quickAddResult(result: GeoResult) {
    const optimisticPlace = getOptimisticSavedPlace(result);
    const quickTitle = getSearchResultDisplay(result.address, result.display_name).title;

    setQuickAddingPlaceId(result.place_id);
    setSaveMsg(null);
    setPageError(null);
    setSelected(null);
    setQuickAddedSpotlight(result);
    setSavedPlaces((current) =>
      current.some((place) => place.place_id === optimisticPlace.place_id) ? current : [optimisticPlace, ...current]
    );
    setResults([]);
    setQ("");
    setSearchError(null);
    setSearching(false);
    setSearchOpen(false);
    pendingAddRestingResetRef.current = true;
    abortRef.current?.abort();
    searchInputRef.current?.blur();
    setSheetOffset(sheetSnaps.collapsed);

    try {
      await persistPlace(result);
      setMapViewportResetKey((current) => current + 1);
      void loadPage();
      setSaveMsg(null);
      showQuickToast(quickTitle);
    } catch (error: unknown) {
      setSavedPlaces((current) => current.filter((place) => place.place_id !== optimisticPlace.place_id));
      setQuickAddedSpotlight(null);
      setSaveMsg(error instanceof Error ? error.message : "Could not save place.");
    } finally {
      setQuickAddingPlaceId(null);
    }
  }

  async function removeCity(cityKey: string, placeIds: string[]) {
    setDeletingCityKey(cityKey);
    setPendingDelete(null);
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
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      startY: event.clientY,
      startOffset: sheetOffset ?? sheetSnaps.collapsed,
    };
    setSheetDragging(true);
  }

  function handleSheetDragMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
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

  function handleSheetDragEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setSheetDragging(false);
  }

  function expandSheetFully() {
    setSheetOffset(sheetSnaps.expanded);
  }

  function changeTab(nextTab: AppTab) {
    setActiveTab(nextTab);
    setSheetOffset(nextTab === "add" ? sheetSnaps.collapsed : sheetSnaps.mid);
  }

  const mapViewportInsets = useMemo(
    () => ({
      topLeft: [20, 92] as [number, number],
      bottomRight: [20, 320] as [number, number],
    }),
    []
  );

  function requestRemoveCity(cityKey: string, cityName: string, placeIds: string[]) {
    setPendingDelete({ cityKey, cityName, placeIds });
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
    transition:
      sheetDragging || searchExperienceOpen || keyboardOpen
        ? "none"
        : "height 380ms cubic-bezier(0.32, 0.72, 0, 1)",
  } as const;
  const appShellStyle = shellHeight ? { height: `${shellHeight}px` } : undefined;

  return (
    <div className="relative overflow-hidden bg-[#fafbfc] text-[#111214]" style={appShellStyle}>
      <div className="absolute inset-0">
        <PlacesMap
          places={savedPlaces}
          mode="country"
          previewPlace={activeTab === "add" ? selected : null}
          spotlightPlace={activeTab === "add" ? quickAddedSpotlight : null}
          heightClassName="h-full"
          containerClassName="h-full w-full"
          theme="light"
          focusStrategy="world"
          viewportInsets={mapViewportInsets}
          viewportResetKey={mapViewportResetKey}
        />
      </div>

      <div className="pointer-events-none relative z-10 h-full px-2 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-[calc(env(safe-area-inset-top)+12px)] sm:px-4">
      {activeTab === "add" && selected && selectedDisplay ? (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+76px)] flex justify-center px-3 sm:px-4">
            <div className="pointer-events-auto w-full max-w-[420px] rounded-[26px] border border-white/80 bg-white/94 p-4 shadow-[0_18px_50px_rgba(17,18,20,0.16)] backdrop-blur-xl">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9aa0a6]">Add This Place</div>
              <div className="mt-2 text-xl font-bold tracking-[-0.03em] text-[#111214]">
                {getSearchResultDisplay(selected.address, selected.display_name).title}
              </div>
              <div className="mt-1 text-sm text-[#7f848b]">
                {getSearchResultDisplay(selected.address, selected.display_name).context}
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={resetComposer}
                  className="flex-1 rounded-xl border border-[#e1e4e8] bg-white px-4 py-3 text-sm font-medium text-[#3d4249] transition hover:bg-[#f8f9fa]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveSelected}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-[#111214] px-4 py-3 text-sm font-semibold text-white shadow-[0_1px_3px_rgba(0,0,0,0.18)] transition hover:bg-[#2a2d31] disabled:opacity-40"
                >
                  {saving ? "Adding..." : "Add place"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-2 pb-[calc(env(safe-area-inset-bottom)+6px)] sm:px-4">
          <section className="pointer-events-auto relative w-full max-w-[560px]">
            {quickToastLabel ? (
              <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-[calc(100%+10px)]">
                <div className="rounded-full border border-white/80 bg-white/94 px-4 py-2 text-sm font-medium text-[#3d4249] shadow-[0_14px_32px_rgba(17,18,20,0.16)] backdrop-blur-xl">
                  {quickToastLabel}
                </div>
              </div>
            ) : null}
            <div
              style={sheetStyle}
              className="relative overflow-hidden rounded-[28px] bg-white/85 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_16px_56px_rgba(0,0,0,0.12)] backdrop-blur-xl"
            >
              <div className="flex h-full flex-col">
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
                        className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/50 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.28),_transparent_32%),linear-gradient(145deg,_#2a1a58_0%,_#111827_42%,_#0a0f1a_100%)] text-xs font-semibold text-white shadow-[0_10px_24px_rgba(17,18,20,0.16)]"
                        aria-label="Open profile menu"
                        aria-expanded={profileMenuOpen}
                      >
                        {profileImageUrl ? (
                          <Image
                            src={profileImageUrl}
                            alt={`${displayName} profile`}
                            width={44}
                            height={44}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <>
                            <span className="pointer-events-none absolute inset-x-1 top-1 h-4 rounded-full bg-white/18 blur-md" />
                            <span className="relative">{initials}</span>
                          </>
                        )}
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

                {activeTab === "add" ? (
                  <div className="flex min-h-0 flex-1 flex-col px-5 pb-4 pt-1">
                    {pageError ? (
                      <div className="rounded-xl border border-[#f5c6c6] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
                        {pageError}
                      </div>
                    ) : null}

                    <section className={`flex min-h-0 flex-1 flex-col ${pageError ? "pt-3" : ""}`}>
                      <div className="shrink-0 rounded-[26px] border border-[#e6e9ed] bg-[#f8fafb]/98 p-3 shadow-[0_10px_30px_rgba(17,18,20,0.06)]">
                        <div className="flex items-center gap-3">
                          <label className="flex min-w-0 flex-1 items-center gap-3 rounded-[20px] border border-[#dfe3e8] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                            <span className="text-[#6f767d]">
                              <SearchIcon />
                            </span>
                            <input
                              ref={searchInputRef}
                              value={q}
                              onChange={(event) => {
                                setQ(event.target.value);
                                setResults([]);
                                setSelected(null);
                                setQuickAddedSpotlight(null);
                                setSaveMsg(null);
                                setSearchOpen(true);
                              }}
                              onFocus={() => {
                                setQuickAddedSpotlight(null);
                                setSearchOpen(true);
                                expandSheetFully();
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Escape") {
                                  dismissSearchExperience();
                                }
                              }}
                              autoComplete="off"
                              enterKeyHint="search"
                              placeholder="Search for a city"
                              spellCheck={false}
                              className="w-full bg-transparent text-base text-[#111214] outline-none"
                            />
                            {q ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  clearSearchInput();
                                }}
                                aria-label="Clear search"
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f1f3f5] text-[#7f8790] transition hover:bg-[#e7eaee] hover:text-[#58606a]"
                              >
                                <ClearIcon />
                              </button>
                            ) : null}
                            {searching ? (
                              <span className="shrink-0 text-xs font-medium text-[#9aa0a6]">Searching...</span>
                            ) : null}
                          </label>

                          {searchExperienceOpen ? (
                            <button
                              type="button"
                              onClick={dismissSearchExperience}
                              className="shrink-0 rounded-full px-1 text-sm font-medium text-[#6f767d]"
                            >
                              Done
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {searchExperienceOpen ? (
                        <div className="min-h-0 flex-1 pt-3">
                          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[#e7eaee] bg-white shadow-[0_14px_34px_rgba(17,18,20,0.08)]">
                            <div
                              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
                              style={{ WebkitOverflowScrolling: "touch" }}
                            >
                              {saveMsg ? (
                                <div className="p-4 pb-0">
                                  <div className="rounded-[18px] bg-[#f7f8f9] px-4 py-3 text-sm text-[#5c6167]">
                                    {saveMsg}
                                  </div>
                                </div>
                              ) : null}

                              {searchError ? (
                                <div className="p-4">
                                  <div className="rounded-[18px] border border-[#f5c6c6] bg-[#fef2f2] px-3.5 py-3 text-sm text-[#b91c1c]">
                                    {searchError}
                                  </div>
                                </div>
                              ) : null}

                              {!searchError && trimmedQuery && !canSearch ? (
                                <div className="p-4">
                                  <div className="rounded-[18px] bg-[#f7f8f9] px-4 py-4 text-sm text-[#7f848b]">
                                    Keep typing to unlock city suggestions.
                                  </div>
                                </div>
                              ) : null}

                              {!searchError && canSearch && searching && results.length === 0 ? (
                                <div className="space-y-3 p-4">
                                  {[0, 1, 2].map((index) => (
                                    <div
                                      key={index}
                                      className="animate-pulse rounded-[18px] border border-[#f1f3f5] px-4 py-4"
                                    >
                                      <div className="h-4 w-32 rounded-full bg-[#eef1f4]" />
                                      <div className="mt-2 h-3 w-40 rounded-full bg-[#f3f5f7]" />
                                    </div>
                                  ))}
                                </div>
                              ) : null}

                              {!searchError && canSearch && !searching && results.length === 0 ? (
                                <div className="p-4">
                                  <div className="rounded-[18px] bg-[#f7f8f9] px-4 py-4 text-sm text-[#7f848b]">
                                    Try a more specific city name or a nearby spelling.
                                  </div>
                                </div>
                              ) : null}

                              {results.length > 0 ? (
                                <div className="divide-y divide-[#f1f3f5]">
                                  {results.map((result) => {
                                    const display = getSearchResultDisplay(result.address, result.display_name);
                                    const stableResultId = getOptimisticSavedPlace(result).place_id;
                                    const isAlreadyAdded = savedPlaceIds.has(stableResultId);
                                    const isQuickAdding = quickAddingPlaceId === result.place_id;
                                    return (
                                      <div
                                        key={result.place_id}
                                        className="flex items-center gap-3 px-4 py-3"
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!isAlreadyAdded) {
                                              pickResult(result);
                                            }
                                          }}
                                          disabled={isAlreadyAdded}
                                          className={`min-w-0 flex-1 rounded-[18px] px-1 py-1 text-left transition ${
                                            isAlreadyAdded
                                              ? "cursor-default text-[#a1a7ae]"
                                              : "active:bg-[#f5f7f8]"
                                          }`}
                                        >
                                          <div
                                            className={`text-[15px] font-semibold leading-snug ${
                                              isAlreadyAdded ? "text-[#9aa0a6]" : "text-[#111214]"
                                            }`}
                                          >
                                            {display.title}
                                          </div>
                                          {display.context ? (
                                            <div className={`mt-1 text-sm ${isAlreadyAdded ? "text-[#b0b5bb]" : "text-[#8b9299]"}`}>
                                              {display.context}
                                            </div>
                                          ) : null}
                                        </button>
                                        {isAlreadyAdded ? (
                                          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e2e6ea] bg-[#f3f5f7] text-[#9aa0a6]">
                                            <CheckIcon />
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => quickAddResult(result)}
                                            disabled={isQuickAdding}
                                            aria-label={isQuickAdding ? `Adding ${display.title}` : `Quick add ${display.title}`}
                                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e2e6ea] bg-[#111214] text-white shadow-[0_8px_20px_rgba(17,18,20,0.12)] transition hover:bg-[#2a2d31] disabled:opacity-50"
                                          >
                                            {isQuickAdding ? (
                                              <span className="text-[11px] font-semibold">...</span>
                                            ) : (
                                              <QuickAddIcon />
                                            )}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          ref={contentScrollRef}
                          className="min-h-0 flex-1 overflow-y-auto pt-3"
                          style={{ WebkitOverflowScrolling: "touch" }}
                        >
                          {selected ? (
                            <div className="rounded-[24px] bg-[#f7f8f9] px-4 py-5 text-sm leading-6 text-[#7f848b]">
                              Previewing your selected place on the map. Confirm from the map card to add it.
                            </div>
                          ) : null}

                          {saveMsg ? <div className="mt-4 text-sm text-[#5c6167]">{saveMsg}</div> : null}
                        </div>
                      )}
                    </section>
                  </div>
                ) : (
                  <div
                    ref={contentScrollRef}
                    className="flex-1 overflow-y-auto px-5 pb-4 pt-1"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    {pageError ? (
                      <div className="rounded-xl border border-[#f5c6c6] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
                        {pageError}
                      </div>
                    ) : null}

                    {activeTab === "places" ? (
                      <section className="space-y-4">
                        <div className="relative overflow-hidden rounded-[30px] border border-white/12 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.22),_transparent_26%),linear-gradient(145deg,_#243b71_0%,_#111827_44%,_#0b1220_100%)] shadow-[0_24px_80px_rgba(10,16,28,0.26)]">
                          <div className="pointer-events-none absolute inset-0">
                            <div className="absolute -right-14 top-[-56px] h-44 w-44 rounded-full bg-[#ffd972]/24 blur-3xl" />
                            <div className="absolute left-[-28px] top-16 h-36 w-36 rounded-full bg-[#79ddff]/18 blur-3xl" />
                            <div className="absolute inset-x-5 top-3 h-16 rounded-full bg-white/10 blur-2xl" />
                          </div>
                          <div className="relative p-4">
                            <div className="flex items-end justify-between gap-3">
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/52">
                                  World Explored
                                </div>
                                <div className="mt-1 text-[2rem] font-semibold tracking-[-0.06em] text-white">
                                  {stats.percentWorldTraveled.toFixed(1)}%
                                </div>
                              </div>
                              <div className="rounded-full border border-white/12 bg-white/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/70 backdrop-blur-md">
                                Snapshot
                              </div>
                            </div>

                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/20">
                              <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,_#f7cf62_0%,_#84ddff_45%,_#d0a0ff_100%)] shadow-[0_0_18px_rgba(132,221,255,0.55)]"
                                style={{ width: `${Math.max(0, Math.min(100, stats.percentWorldTraveled))}%` }}
                              />
                            </div>

                            <div className="mt-3 grid grid-cols-3 gap-2.5">
                              {[
                                { label: "Cities", value: stats.uniqueCities },
                                { label: "Countries", value: stats.uniqueCountries },
                                { label: "Continents", value: stats.uniqueContinents },
                              ].map(({ label, value }) => (
                                <div
                                  key={label}
                                  className="rounded-[18px] border border-white/10 bg-black/15 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-md"
                                >
                                  <div className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/58">
                                    {label}
                                  </div>
                                  <div className="mt-1 text-xl font-semibold tracking-[-0.04em] text-white">
                                    {value}
                                  </div>
                                </div>
                              ))}
                            </div>
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
                              onRequestRemove={requestRemoveCity}
                            />
                          ))}
                        </div>
                      )}
                      </section>
                    ) : null}

                    {activeTab === "share" ? (
                      <ShareTab displayName={displayName} stats={stats} session={session} />
                    ) : null}
                  </div>
                )}

                <div className="px-4 pb-4 pt-1">
                  <div className="flex items-stretch gap-1.5 rounded-2xl bg-[#111214]/[0.07] p-1.5">
                    <BottomTab
                      active={activeTab === "add"}
                      icon={<PlusIcon />}
                      label="Add Place"
                      onClick={() => changeTab("add")}
                    />
                    <BottomTab
                      active={activeTab === "places"}
                      icon={<ListIcon />}
                      label="My Places"
                      onClick={() => changeTab("places")}
                    />
                    <BottomTab
                      active={activeTab === "share"}
                      icon={<ShareIcon />}
                      label="Share"
                      onClick={() => changeTab("share")}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {pendingDelete ? (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-[#111214]/28 px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-6 backdrop-blur-[2px] sm:items-center sm:pb-6">
          <div className="w-full max-w-[360px] rounded-[28px] border border-white/70 bg-white/96 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)] backdrop-blur-xl">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9aa0a6]">
              Confirm Delete
            </div>
            <div className="mt-2 text-xl font-bold tracking-[-0.03em] text-[#111214]">
              Remove {pendingDelete.cityName}?
            </div>
            <p className="mt-2 text-sm leading-6 text-[#7f848b]">
              This will remove the city from your places list and map.
            </p>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="flex-1 rounded-xl border border-[#e1e4e8] bg-white px-4 py-3 text-sm font-medium text-[#3d4249] transition hover:bg-[#f8f9fa]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => removeCity(pendingDelete.cityKey, pendingDelete.placeIds)}
                className="flex-1 rounded-xl bg-[#111214] px-4 py-3 text-sm font-semibold text-white shadow-[0_1px_3px_rgba(0,0,0,0.18)] transition hover:bg-[#2a2d31]"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
