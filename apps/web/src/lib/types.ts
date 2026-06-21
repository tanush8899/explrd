export type SavedPlace = {
  place_id: string;
  name: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  continent: string | null;
  normalized_city: string | null;
  normalized_state: string | null;
  normalized_country: string | null;
  normalized_continent: string | null;
  lat: number;
  lng: number;
  formatted: string | null;
  city_boundary: GeoFeatureCollection | null;
  state_boundary: GeoFeatureCollection | null;
  country_boundary: GeoFeatureCollection | null;
  continent_boundary: GeoFeatureCollection | null;
};

export type MapMode = "city" | "state" | "country" | "continent";

export type Geometry =
  | {
      type: "Polygon";
      coordinates: number[][][];
    }
  | {
      type: "MultiPolygon";
      coordinates: number[][][][];
    };

export type GeoFeature = {
  type: "Feature";
  properties: Record<string, string | number | boolean | null>;
  geometry: Geometry;
};

export type GeoFeatureCollection = {
  type: "FeatureCollection";
  features: GeoFeature[];
};

export type UserProfile = {
  user_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  public_slug: string | null;
  bio: string | null;
  is_public: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type FriendSummary = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export type FriendRequestSummary = FriendSummary & {
  request_id: string;
  created_at: string | null;
};

export type FriendsPayload = {
  friends: FriendSummary[];
  incoming: FriendRequestSummary[];
  outgoing: FriendRequestSummary[];
};

export type ApiErrorResponse = {
  error?: string;
  details?: string;
};

export type PublicProfilePayload = {
  profile: UserProfile;
  places: SavedPlace[];
};

/** Anonymized comparison of the current explorer against everyone else, from
 *  /api/community-stats. Only aggregate numbers are exposed — never names or
 *  individual maps. `enoughData` is false (and the detail fields null) until the
 *  community is large enough for averages/percentiles to be meaningful. */
export type CommunityComparison = {
  enoughData: boolean;
  explorerCount: number;
  minExplorers: number;
  averages: {
    uniqueCountries: number;
    uniqueCities: number;
    uniqueContinents: number;
    percentWorldTraveled: number;
    score: number;
  } | null;
  you: {
    /** 1-based rank by explrd score; 1 = most explored. */
    rank: number;
    /** e.g. 15 → "top 15% of explorers". */
    topPercent: number;
    uniqueCountries: number;
    uniqueCities: number;
    uniqueContinents: number;
    percentWorldTraveled: number;
    score: number;
  } | null;
  rarestStamp: {
    label: string;
    country: string | null;
    /** How many OTHER explorers have also stamped this place. */
    otherExplorers: number;
  } | null;
};
