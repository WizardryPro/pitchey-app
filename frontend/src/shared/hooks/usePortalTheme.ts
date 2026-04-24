/**
 * Portal theme tokens — pre-enumerated Tailwind class strings per portal.
 *
 * Why pre-enumerated rather than template-literal (`bg-${color}-600`): Tailwind
 * JIT only generates CSS for classes it can statically see in source. Dynamic
 * concatenation would require a safelist. Enumerating each portal × each slot
 * puts every class as a literal in this file, which the JIT picks up during
 * build. Verbose at the definition site, but one file to maintain.
 *
 * The single hex definitions in tailwind.config.js (brand.portal-watcher,
 * etc.) are intentionally not used here — they're one shade each, and portal
 * theming needs a range (light bg → solid button → hover state → ring), which
 * Tailwind's shade-scale palette (cyan-100/500/600/700) handles for free.
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
  /** Human-readable accent color for debugging — not for className use. */
  accentName: string;

  // Solid-surface slots (buttons, tab underlines)
  btnPrimary: string;           // bg + hover + text-white
  btnPrimaryDisabled: string;   // same shape, disabled states muted

  // Tab nav
  tabActiveBorder: string;      // border-<c>-500
  tabActiveText: string;        // text-<c>-600

  // Focus / input
  focusRing: string;            // focus:ring-<c>-500
  peerFocusRing: string;        // peer-focus:ring-<c>-300
  inputFocus: string;           // focus:ring-2 focus:ring-<c>-500 + focus:border-transparent

  // Toggle switch (tailwind peer pattern)
  toggleChecked: string;        // peer-checked:bg-<c>-600

  // Accent surfaces
  bgLight: string;              // bg-<c>-50 — page-level tints
  bgLightHover: string;         // hover:bg-<c>-50
  bgMuted: string;              // bg-<c>-100 — pill backgrounds
  textAccent: string;           // text-<c>-600
  textAccentHover: string;      // hover:text-<c>-700
  textOnSolid: string;          // text-<c>-100 — for text on solid bg

  // Persistent identity
  stripTop: string;             // h-1 bg-<c>-500 — layout identity strip
  badge: string;                // pill for role badge (bg-<c>-100 text-<c>-700)
  /** Full composite for the MinimalHeader credit pill: bg + text + hover bg. */
  creditPill: string;

  // Hero / gradient elements
  heroGradient: string;         // bg-gradient-to-r from-<c>-600 to-<c2>-600

  // Loading spinner
  spinnerBorder: string;        // border-<c>-600
}

const THEMES: Record<PortalKey, PortalTheme> = {
  creator: {
    key: 'creator',
    label: 'Creator',
    accentName: 'purple',
    btnPrimary: 'bg-purple-600 hover:bg-purple-700 text-white',
    btnPrimaryDisabled: 'bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed',
    tabActiveBorder: 'border-purple-500',
    tabActiveText: 'text-purple-600',
    focusRing: 'focus:ring-purple-500',
    peerFocusRing: 'peer-focus:ring-purple-300',
    inputFocus: 'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent',
    toggleChecked: 'peer-checked:bg-purple-600',
    bgLight: 'bg-purple-50',
    bgLightHover: 'hover:bg-purple-50',
    bgMuted: 'bg-purple-100',
    textAccent: 'text-purple-600',
    textAccentHover: 'hover:text-purple-700',
    textOnSolid: 'text-purple-100',
    stripTop: 'bg-purple-500',
    badge: 'bg-purple-100 text-purple-700',
    creditPill: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
    heroGradient: 'bg-gradient-to-r from-purple-600 to-indigo-600',
    spinnerBorder: 'border-purple-600',
  },
  investor: {
    key: 'investor',
    label: 'Investor',
    accentName: 'green',
    btnPrimary: 'bg-green-600 hover:bg-green-700 text-white',
    btnPrimaryDisabled: 'bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed',
    tabActiveBorder: 'border-green-500',
    tabActiveText: 'text-green-600',
    focusRing: 'focus:ring-green-500',
    peerFocusRing: 'peer-focus:ring-green-300',
    inputFocus: 'focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent',
    toggleChecked: 'peer-checked:bg-green-600',
    bgLight: 'bg-green-50',
    bgLightHover: 'hover:bg-green-50',
    bgMuted: 'bg-green-100',
    textAccent: 'text-green-600',
    textAccentHover: 'hover:text-green-700',
    textOnSolid: 'text-green-100',
    stripTop: 'bg-green-500',
    badge: 'bg-green-100 text-green-700',
    creditPill: 'bg-green-100 text-green-700 hover:bg-green-200',
    heroGradient: 'bg-gradient-to-r from-green-600 to-emerald-600',
    spinnerBorder: 'border-green-600',
  },
  production: {
    key: 'production',
    label: 'Production',
    accentName: 'blue',
    btnPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
    btnPrimaryDisabled: 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed',
    tabActiveBorder: 'border-blue-500',
    tabActiveText: 'text-blue-600',
    focusRing: 'focus:ring-blue-500',
    peerFocusRing: 'peer-focus:ring-blue-300',
    inputFocus: 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
    toggleChecked: 'peer-checked:bg-blue-600',
    bgLight: 'bg-blue-50',
    bgLightHover: 'hover:bg-blue-50',
    bgMuted: 'bg-blue-100',
    textAccent: 'text-blue-600',
    textAccentHover: 'hover:text-blue-700',
    textOnSolid: 'text-blue-100',
    stripTop: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700',
    creditPill: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    heroGradient: 'bg-gradient-to-r from-blue-600 to-indigo-600',
    spinnerBorder: 'border-blue-600',
  },
  watcher: {
    key: 'watcher',
    label: 'Watcher',
    accentName: 'cyan',
    btnPrimary: 'bg-cyan-600 hover:bg-cyan-700 text-white',
    btnPrimaryDisabled: 'bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50 disabled:cursor-not-allowed',
    tabActiveBorder: 'border-cyan-500',
    tabActiveText: 'text-cyan-600',
    focusRing: 'focus:ring-cyan-500',
    peerFocusRing: 'peer-focus:ring-cyan-300',
    inputFocus: 'focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent',
    toggleChecked: 'peer-checked:bg-cyan-600',
    bgLight: 'bg-cyan-50',
    bgLightHover: 'hover:bg-cyan-50',
    bgMuted: 'bg-cyan-100',
    textAccent: 'text-cyan-600',
    textAccentHover: 'hover:text-cyan-700',
    textOnSolid: 'text-cyan-100',
    stripTop: 'bg-cyan-500',
    badge: 'bg-cyan-100 text-cyan-700',
    creditPill: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200',
    heroGradient: 'bg-gradient-to-r from-cyan-600 via-sky-600 to-sky-700',
    spinnerBorder: 'border-cyan-600',
  },
  admin: {
    key: 'admin',
    label: 'Admin',
    accentName: 'indigo',
    btnPrimary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    btnPrimaryDisabled: 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed',
    tabActiveBorder: 'border-indigo-500',
    tabActiveText: 'text-indigo-600',
    focusRing: 'focus:ring-indigo-500',
    peerFocusRing: 'peer-focus:ring-indigo-300',
    inputFocus: 'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
    toggleChecked: 'peer-checked:bg-indigo-600',
    bgLight: 'bg-indigo-50',
    bgLightHover: 'hover:bg-indigo-50',
    bgMuted: 'bg-indigo-100',
    textAccent: 'text-indigo-600',
    textAccentHover: 'hover:text-indigo-700',
    textOnSolid: 'text-indigo-100',
    stripTop: 'bg-indigo-500',
    badge: 'bg-indigo-100 text-indigo-700',
    creditPill: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
    heroGradient: 'bg-gradient-to-r from-indigo-600 to-purple-600',
    spinnerBorder: 'border-indigo-600',
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
