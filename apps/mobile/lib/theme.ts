import { Platform, type TextStyle, type ViewStyle } from "react-native";

/**
 * explrd design system — Flighty-inspired.
 *
 * Single source of truth for color, type, spacing, radii and elevation.
 * Everything visual in the app should reference these tokens rather than
 * hardcoding values, so the look stays consistent and is easy to retune.
 */

// ── Color ───────────────────────────────────────────────────────────────────
export const colors = {
  // Neutrals (light surfaces — the bright Flighty sheet)
  bg:            "#ffffff",
  ink:           "#0b0c0e", // primary text / titles
  inkSecondary:  "#3c3c43", // secondary text
  muted:         "#8e8e93", // tertiary / placeholder / captions
  faint:         "#a8acb3", // quaternary
  hairline:      "#e5e5ea", // separators / borders
  fill:          "#f2f2f7", // iOS systemFill — gray cards/chips
  fillSecondary: "#eff1f3", // search capsule / inset fields
  card:          "#ffffff", // elevated white card

  // Accent — Flighty blue
  blue:      "#007aff",
  bluePress: "#0066d6",
  blueSoft:  "rgba(0,122,255,0.10)", // tinted icon wells / soft fills

  // Brand gold (avatar / passport accent)
  gold:    "#ecd393",
  goldInk: "#5b4a17",

  // Semantic
  danger:     "#ff3b30",
  dangerSoft: "rgba(255,59,48,0.10)",
  success:    "#34c759",

  // On-dark text (used inside dark gradient hero cards)
  onDark:          "#ffffff",
  onDarkSecondary: "rgba(255,255,255,0.7)",
  onDarkMuted:     "rgba(255,255,255,0.5)",
  onDarkFill:      "rgba(255,255,255,0.08)",

  // Dark glass (floating controls over the globe)
  glassDarkHairline: "rgba(255,255,255,0.14)",
  glassDarkSpecular: "rgba(255,255,255,0.28)",
} as const;

// ── Gradients (the signature hero cards) ─────────────────────────────────────
export const gradients = {
  hero:     ["#0f1829", "#1a3050"] as [string, string], // stats / VS / score
  passport: ["#2a1a58", "#111827", "#0a0f1a"] as [string, string, string],
  progress: ["#3b82f6", "#8b5cf6"] as [string, string],
  auth:     ["#0c1023", "#080b16", "#05070d"] as [string, string, string],
} as const;

// ── Radii ────────────────────────────────────────────────────────────────────
export const radius = {
  xs:    10,
  sm:    14,
  md:    16,
  lg:    20,
  xl:    28,
  sheet: 44, // iPhone continuous corner curve
  pill:  999,
} as const;

// ── Spacing (4-pt scale) ──────────────────────────────────────────────────────
export const space = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
} as const;

// ── Typography ────────────────────────────────────────────────────────────────
// iOS system font (SF Pro) — no custom asset required.
const FONT = Platform.select({ ios: undefined, default: undefined });

export const type = {
  largeTitle: { fontFamily: FONT, fontSize: 34, fontWeight: "800", letterSpacing: -0.9, color: colors.ink } as TextStyle,
  title:      { fontFamily: FONT, fontSize: 22, fontWeight: "700", letterSpacing: -0.4, color: colors.ink } as TextStyle,
  title3:     { fontFamily: FONT, fontSize: 20, fontWeight: "700", letterSpacing: -0.3, color: colors.ink } as TextStyle,
  headline:   { fontFamily: FONT, fontSize: 17, fontWeight: "600", letterSpacing: -0.2, color: colors.ink } as TextStyle,
  body:       { fontFamily: FONT, fontSize: 17, fontWeight: "400", color: colors.ink } as TextStyle,
  subhead:    { fontFamily: FONT, fontSize: 15, fontWeight: "400", color: colors.inkSecondary } as TextStyle,
  footnote:   { fontFamily: FONT, fontSize: 13, fontWeight: "400", color: colors.muted } as TextStyle,
  caption:    { fontFamily: FONT, fontSize: 11, fontWeight: "400", color: colors.muted } as TextStyle,
  eyebrow:    {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.muted,
  } as TextStyle,
} as const;

// ── Elevation ────────────────────────────────────────────────────────────────
export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  } as ViewStyle,
  floating: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 6,
  } as ViewStyle,
  sheet: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.13,
    shadowRadius: 28,
    elevation: 16,
  } as ViewStyle,
  hero: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  } as ViewStyle,
} as const;

export const theme = { colors, gradients, radius, space, type, shadow };
export default theme;
