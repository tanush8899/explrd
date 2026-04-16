import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

function signingSecret(): string {
  // Use service role key as HMAC secret — server-only, never exposed to client
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
  return secret;
}

export function buildShareToken(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + EXPIRY_SECONDS;
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp })).toString("base64url");
  const sig = createHmac("sha256", signingSecret()).update(payload).digest("hex").slice(0, 24);
  return `${payload}.${sig}`;
}

export function verifyShareToken(token: string): { uid: string; exp: number } | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac("sha256", signingSecret()).update(payload).digest("hex").slice(0, 24);
    if (sig !== expected) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { uid: string; exp: number };
    if (!data.uid || !data.exp) return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

async function getAuthedUser(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { response: NextResponse.json({ error: "missing_env" }, { status: 500 }) };
  }
  const supabase = createClient(supabaseUrl, serviceKey);
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "") || null;
  if (!token) return { response: NextResponse.json({ error: "missing_token" }, { status: 401 }) };
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { response: NextResponse.json({ error: "invalid_token" }, { status: 401 }) };
  return { user };
}

// POST — generate a fresh 7-day share token for the authenticated user
export async function POST(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if ("response" in auth) return auth.response;
    const token = buildShareToken(auth.user.id);
    const expiresAt = new Date((Math.floor(Date.now() / 1000) + EXPIRY_SECONDS) * 1000).toISOString();
    return NextResponse.json({ token, expiresAt });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "server_exception", details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
