import { NextResponse } from "next/server";
import { resolveBoundaryFeatureCollection } from "@/lib/region-boundaries";
import type { MapMode } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "").trim() as MapMode;
  const query = (url.searchParams.get("query") ?? "").trim();
  const placeId = (url.searchParams.get("placeId") ?? "").trim();
  const city = (url.searchParams.get("city") ?? "").trim();
  const state = (url.searchParams.get("state") ?? "").trim();
  const country = (url.searchParams.get("country") ?? "").trim();
  const continent = (url.searchParams.get("continent") ?? "").trim();
  const latParam = (url.searchParams.get("lat") ?? "").trim();
  const lngParam = (url.searchParams.get("lng") ?? "").trim();
  const lat = latParam ? Number(latParam) : null;
  const lng = lngParam ? Number(lngParam) : null;

  if (!mode) {
    return NextResponse.json({ error: "missing_mode" }, { status: 400 });
  }

  const featureCollection = await resolveBoundaryFeatureCollection({
    mode,
    query,
    placeId,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    city,
    state,
    country,
    continent,
  });

  if (!featureCollection) {
    return NextResponse.json({ error: "boundary_not_found" }, { status: 404 });
  }

  return NextResponse.json({ featureCollection });
}
