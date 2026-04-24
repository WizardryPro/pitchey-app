/**
 * Portal theme tokens — built on the `brand.portal-*` design-system tokens
 * defined in tailwind.config.js. Each portal has a single canonical hex
 * (e.g. `#5B4FC7` for investor); shades are derived via Tailwind's opacity
 * modifier (`/10`, `/90`, etc.) so the entire accent palette of a portal is
 * tied to one source-of-truth color.
 *
 * Why not Tailwind's shade palette (cyan-100/500/600 etc.)? Because the
 * design system already has brand tokens, login pages and sidebars already
 * use them, and deriving accents from a Tailwind shade scale was a parallel
 * universe where investor was "green" (a bug inherited from the old
 * getPortalColor() in MinimalHeader). Using the brand tokens directly keeps
 * one source of truth.
 *
 * Why pre-enumerated per portal rather than a single template? Tailwind JIT
 * only generates CSS for classes it can statically see in source. Listing
 * each slot × each portal as a literal means every class appears in this
 * file, which the JIT picks up during build. Verbose at the definition
 * site, but one file to maintain.
 *
 * DB stores user_type='viewer' for watchers (legacy). Callers pass the raw
 * user_type; the hook normalizes to the portal key.
 */
import { useMemo } from 'react';
import { useBetterAuthStore } from '@/store/betterAuthStore';

export type PortalKey = 'creator' | 'investor' | 'production' | 'watcher' | 'admin';

export interface PortalTheme {
  key: PortalKey;
  label: string;
  /** Raw design-token name, for debugging. Not a className. */
  tokenName: string;

  // Solid-surface slots (buttons, tab underlines)
  btnPrimary: string;           // bg-<token> + hover:bg-<token>/90 + text-white
  btnPrimaryDisabled: string;   // same + disabled states muted

  // Tab nav
  tabActiveBorder: string;      // border-<token>
  tabActiveText: string;        // text-<token>

  // Focus / input
  focusRing: string;            // focus:ring-<token>
  peerFocusRing: string;        // peer-focus:ring-<token>/30
  inputFocus: string;           // focus:outline-none focus:ring-2 focus:ring-<token> focus:border-transparent

  // Toggle switch (tailwind peer pattern)
  toggleChecked: string;        // peer-checked:bg-<token>

  // Accent surfaces — use opacity to derive light/muted variants
  bgLight: string;              // bg-<token>/5
  bgLightHover: string;         // hover:bg-<token>/5
  bgMuted: string;              // bg-<token>/10 — pill backgrounds
  textAccent: string;           // text-<token>
  textAccentHover: string;      // hover:opacity-80 — brand color doesn't have a hover shade, opacity is the next best thing
  textOnSolid: string;          // text-white/80 — secondary text over a solid brand bg

  // Hover variants — Tailwind JIT needs these as literals (can't generate
  // `hover:${theme.tabActiveBorder}` from a template). Enumerate per portal.
  borderAccentHover: string;    // hover:border-<token> — dropzone/card rollovers

  // Persistent identity
  stripTop: string;             // bg-<token> — layout identity strip
  badge: string;                // bg-<token>/10 text-<token>
  /** Full composite for the MinimalHeader credit pill: bg + text + hover bg. */
  creditPill: string;

  // Hero / gradient elements — single-hue gradient from full to 70% opacity
  heroGradient: string;

  // Loading spinner
  spinnerBorder: string;        // border-<token>
}

function buildTheme(key: PortalKey, label: string, token: string): PortalTheme {
  // `token` is the tail of the brand class (e.g. 'brand-portal-investor').
  // Builder enumerates every slot for every portal so Tailwind JIT sees the
  // full class string in source.
  return {
    key,
    label,
    tokenName: token,
    btnPrimary: `bg-${token} hover:bg-${token}/90 text-white`,
    btnPrimaryDisabled: `bg-${token} hover:bg-${token}/90 text-white disabled:opacity-50 disabled:cursor-not-allowed`,
    tabActiveBorder: `border-${token}`,
    tabActiveText: `text-${token}`,
    focusRing: `focus:ring-${token}`,
    peerFocusRing: `peer-focus:ring-${token}/30`,
    inputFocus: `focus:outline-none focus:ring-2 focus:ring-${token} focus:border-transparent`,
    toggleChecked: `peer-checked:bg-${token}`,
    bgLight: `bg-${token}/5`,
    bgLightHover: `hover:bg-${token}/5`,
    bgMuted: `bg-${token}/10`,
    textAccent: `text-${token}`,
    textAccentHover: 'hover:opacity-80',
    textOnSolid: 'text-white/80',
    borderAccentHover: `hover:border-${token}`,
    stripTop: `bg-${token}`,
    badge: `bg-${token}/10 text-${token}`,
    creditPill: `bg-${token}/10 text-${token} hover:bg-${token}/20`,
    heroGradient: `bg-gradient-to-r from-${token} to-${token}/70`,
    spinnerBorder: `border-${token}`,
  };
}

// NOTE: If you touch these, also touch tailwind.config.js `brand.portal-*`.
// The literal class strings below must appear somewhere JIT can see them.
// buildTheme above produces the right shape; below we also embed the full
// expanded strings so the JIT has them as static literals (template literals
// inside a function don't count for JIT purposes — the output strings do).
const THEMES: Record<PortalKey, PortalTheme> = {
  creator: {
    key: 'creator',
    label: 'Creator',
    tokenName: 'brand-portal-creator',
    btnPrimary: 'bg-brand-portal-creator hover:bg-brand-portal-creator/90 text-white',
    btnPrimaryDisabled: 'bg-brand-portal-creator hover:bg-brand-portal-creator/90 text-white disabled:opacity-50 disabled:cursor-not-allowed',
    tabActiveBorder: 'border-brand-portal-creator',
    tabActiveText: 'text-brand-portal-creator',
    focusRing: 'focus:ring-brand-portal-creator',
    peerFocusRing: 'peer-focus:ring-brand-portal-creator/30',
    inputFocus: 'focus:outline-none focus:ring-2 focus:ring-brand-portal-creator focus:border-transparent',
    toggleChecked: 'peer-checked:bg-brand-portal-creator',
    bgLight: 'bg-brand-portal-creator/5',
    bgLightHover: 'hover:bg-brand-portal-creator/5',
    bgMuted: 'bg-brand-portal-creator/10',
    textAccent: 'text-brand-portal-creator',
    textAccentHover: 'hover:opacity-80',
    textOnSolid: 'text-white/80',
    borderAccentHover: 'hover:border-brand-portal-creator',
    stripTop: 'bg-brand-portal-creator',
    badge: 'bg-brand-portal-creator/10 text-brand-portal-creator',
    creditPill: 'bg-brand-portal-creator/10 text-brand-portal-creator hover:bg-brand-portal-creator/20',
    heroGradient: 'bg-gradient-to-r from-brand-portal-creator to-brand-portal-creator/70',
    spinnerBorder: 'border-brand-portal-creator',
  },
  investor: {
    key: 'investor',
    label: 'Investor',
    tokenName: 'brand-portal-investor',
    btnPrimary: 'bg-brand-portal-investor hover:bg-brand-portal-investor/90 text-white',
    btnPrimaryDisabled: 'bg-brand-portal-investor hover:bg-brand-portal-investor/90 text-white disabled:opacity-50 disabled:cursor-not-allowed',
    tabActiveBorder: 'border-brand-portal-investor',
    tabActiveText: 'text-brand-portal-investor',
    focusRing: 'focus:ring-brand-portal-investor',
    peerFocusRing: 'peer-focus:ring-brand-portal-investor/30',
    inputFocus: 'focus:outline-none focus:ring-2 focus:ring-brand-portal-investor focus:border-transparent',
    toggleChecked: 'peer-checked:bg-brand-portal-investor',
    bgLight: 'bg-brand-portal-investor/5',
    bgLightHover: 'hover:bg-brand-portal-investor/5',
    bgMuted: 'bg-brand-portal-investor/10',
    textAccent: 'text-brand-portal-investor',
    textAccentHover: 'hover:opacity-80',
    textOnSolid: 'text-white/80',
    borderAccentHover: 'hover:border-brand-portal-investor',
    stripTop: 'bg-brand-portal-investor',
    badge: 'bg-brand-portal-investor/10 text-brand-portal-investor',
    creditPill: 'bg-brand-portal-investor/10 text-brand-portal-investor hover:bg-brand-portal-investor/20',
    heroGradient: 'bg-gradient-to-r from-brand-portal-investor to-brand-portal-investor/70',
    spinnerBorder: 'border-brand-portal-investor',
  },
  production: {
    key: 'production',
    label: 'Production',
    tokenName: 'brand-portal-production',
    btnPrimary: 'bg-brand-portal-production hover:bg-brand-portal-production/90 text-white',
    btnPrimaryDisabled: 'bg-brand-portal-production hover:bg-brand-portal-production/90 text-white disabled:opacity-50 disabled:cursor-not-allowed',
    tabActiveBorder: 'border-brand-portal-production',
    tabActiveText: 'text-brand-portal-production',
    focusRing: 'focus:ring-brand-portal-production',
    peerFocusRing: 'peer-focus:ring-brand-portal-production/30',
    inputFocus: 'focus:outline-none focus:ring-2 focus:ring-brand-portal-production focus:border-transparent',
    toggleChecked: 'peer-checked:bg-brand-portal-production',
    bgLight: 'bg-brand-portal-production/5',
    bgLightHover: 'hover:bg-brand-portal-production/5',
    bgMuted: 'bg-brand-portal-production/10',
    textAccent: 'text-brand-portal-production',
    textAccentHover: 'hover:opacity-80',
    textOnSolid: 'text-white/80',
    borderAccentHover: 'hover:border-brand-portal-production',
    stripTop: 'bg-brand-portal-production',
    badge: 'bg-brand-portal-production/10 text-brand-portal-production',
    creditPill: 'bg-brand-portal-production/10 text-brand-portal-production hover:bg-brand-portal-production/20',
    heroGradient: 'bg-gradient-to-r from-brand-portal-production to-brand-portal-production/70',
    spinnerBorder: 'border-brand-portal-production',
  },
  watcher: {
    key: 'watcher',
    label: 'Watcher',
    tokenName: 'brand-portal-watcher',
    btnPrimary: 'bg-brand-portal-watcher hover:bg-brand-portal-watcher/90 text-white',
    btnPrimaryDisabled: 'bg-brand-portal-watcher hover:bg-brand-portal-watcher/90 text-white disabled:opacity-50 disabled:cursor-not-allowed',
    tabActiveBorder: 'border-brand-portal-watcher',
    tabActiveText: 'text-brand-portal-watcher',
    focusRing: 'focus:ring-brand-portal-watcher',
    peerFocusRing: 'peer-focus:ring-brand-portal-watcher/30',
    inputFocus: 'focus:outline-none focus:ring-2 focus:ring-brand-portal-watcher focus:border-transparent',
    toggleChecked: 'peer-checked:bg-brand-portal-watcher',
    bgLight: 'bg-brand-portal-watcher/5',
    bgLightHover: 'hover:bg-brand-portal-watcher/5',
    bgMuted: 'bg-brand-portal-watcher/10',
    textAccent: 'text-brand-portal-watcher',
    textAccentHover: 'hover:opacity-80',
    textOnSolid: 'text-white/80',
    borderAccentHover: 'hover:border-brand-portal-watcher',
    stripTop: 'bg-brand-portal-watcher',
    badge: 'bg-brand-portal-watcher/10 text-brand-portal-watcher',
    creditPill: 'bg-brand-portal-watcher/10 text-brand-portal-watcher hover:bg-brand-portal-watcher/20',
    heroGradient: 'bg-gradient-to-r from-brand-portal-watcher to-brand-portal-watcher/70',
    spinnerBorder: 'border-brand-portal-watcher',
  },
  admin: {
    key: 'admin',
    label: 'Admin',
    tokenName: 'brand-portal-admin',
    btnPrimary: 'bg-brand-portal-admin hover:bg-brand-portal-admin/90 text-white',
    btnPrimaryDisabled: 'bg-brand-portal-admin hover:bg-brand-portal-admin/90 text-white disabled:opacity-50 disabled:cursor-not-allowed',
    tabActiveBorder: 'border-brand-portal-admin',
    tabActiveText: 'text-brand-portal-admin',
    focusRing: 'focus:ring-brand-portal-admin',
    peerFocusRing: 'peer-focus:ring-brand-portal-admin/30',
    inputFocus: 'focus:outline-none focus:ring-2 focus:ring-brand-portal-admin focus:border-transparent',
    toggleChecked: 'peer-checked:bg-brand-portal-admin',
    bgLight: 'bg-brand-portal-admin/5',
    bgLightHover: 'hover:bg-brand-portal-admin/5',
    bgMuted: 'bg-brand-portal-admin/10',
    textAccent: 'text-brand-portal-admin',
    textAccentHover: 'hover:opacity-80',
    textOnSolid: 'text-white/80',
    borderAccentHover: 'hover:border-brand-portal-admin',
    stripTop: 'bg-brand-portal-admin',
    badge: 'bg-brand-portal-admin/10 text-brand-portal-admin',
    creditPill: 'bg-brand-portal-admin/10 text-brand-portal-admin hover:bg-brand-portal-admin/20',
    heroGradient: 'bg-gradient-to-r from-brand-portal-admin to-brand-portal-admin/70',
    spinnerBorder: 'border-brand-portal-admin',
  },
};

/**
 * Normalize raw user_type to portal key. DB stores 'viewer' for watcher (legacy drift).
 */
export function portalKeyFromUserType(userType?: string | null): PortalKey {
  if (!userType) return 'creator';
  if (userType === 'viewer') return 'watcher';
  if (['creator', 'investor', 'production', 'watcher', 'admin'].includes(userType)) {
    return userType as PortalKey;
  }
  return 'creator';
}

/**
 * Get the theme for a specific portal. Pass explicit userType if you know it;
 * omit to read from the current auth state. Safe on public pages (no user) —
 * returns the creator theme as default.
 */
export function usePortalTheme(userType?: string | null): PortalTheme {
  const { user } = useBetterAuthStore();
  const resolved = userType ?? user?.userType;
  return useMemo(() => THEMES[portalKeyFromUserType(resolved)], [resolved]);
}

/**
 * Static access for non-hook contexts (e.g., utility functions).
 */
export function getPortalTheme(userType?: string | null): PortalTheme {
  return THEMES[portalKeyFromUserType(userType)];
}

// Suppress unused-warning on buildTheme — retained as documentation for the
// shape of each entry above. If the hook grows, the builder is the
// straightforward way to refactor without re-enumerating by hand.
void buildTheme;
