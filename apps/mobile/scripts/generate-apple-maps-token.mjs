#!/usr/bin/env node
// Generates a 30-day Apple Maps Server API JWT.
// Run from the apps/mobile directory:  node scripts/generate-apple-maps-token.mjs
// Then copy the output line into apps/mobile/.env.local and restart Expo.

import { sign } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEAM_ID = 'MJ9X93RVH3';
const KEY_ID  = 'KN622J5BLD';
const KEY_PATH = join(__dirname, '../AppleDev/AuthKey_KN622J5BLD.p8');

if (!existsSync(KEY_PATH)) {
  console.error(`\n❌  Key not found at: ${KEY_PATH}\n`);
  process.exit(1);
}

const privateKey = readFileSync(KEY_PATH, 'utf8').trim();

const now = Math.floor(Date.now() / 1000);
const exp = now + 30 * 24 * 60 * 60; // 30 days

function b64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const header  = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }));
const payload = b64url(JSON.stringify({ iss: TEAM_ID, iat: now, exp }));
const message = `${header}.${payload}`;

// Sign with ECDSA + SHA-256 in IEEE P1363 format (r||s, required by JWT ES256)
const sigBuf = sign('SHA256', Buffer.from(message), {
  key: privateKey,
  dsaEncoding: 'ieee-p1363',
});
const sig = sigBuf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const jwt = `${message}.${sig}`;
const expiresAt = new Date(exp * 1000).toLocaleDateString('en-US', {
  year: 'numeric', month: 'long', day: 'numeric',
});

console.log(`\n✅  Apple Maps JWT (valid until ${expiresAt})\n`);
console.log(`Add this line to apps/mobile/.env.local:\n`);
console.log(`EXPO_PUBLIC_APPLE_MAPS_TOKEN=${jwt}\n`);
