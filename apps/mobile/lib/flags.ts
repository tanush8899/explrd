import { getCountryCodeFromCountryName } from "@explrd/shared";

const A = 0x1f1e6; // regional-indicator "A"

/**
 * Emoji flag for a country name — e.g. "France" → 🇫🇷, "United States" → 🇺🇸.
 * Resolves the name to its ISO-3166 alpha-2 code (via the shared alias map),
 * then maps each letter to its regional-indicator symbol. Falls back to a globe
 * when the country can't be resolved. Flags render natively on iOS.
 */
export function countryFlag(country: string | null | undefined): string {
  const code = getCountryCodeFromCountryName(country);
  if (!code || code.length !== 2) return "🌍";
  const cc = code.toUpperCase();
  return String.fromCodePoint(
    A + cc.charCodeAt(0) - 65,
    A + cc.charCodeAt(1) - 65,
  );
}
