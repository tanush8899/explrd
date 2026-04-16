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
  display_name: string | null;
  public_slug: string | null;
  bio: string | null;
  is_public: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type ApiErrorResponse = {
  error?: string;
  details?: string;
};

export type PublicProfilePayload = {
  profile: UserProfile;
  places: SavedPlace[];
};
