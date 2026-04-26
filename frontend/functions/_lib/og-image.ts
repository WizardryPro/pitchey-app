/**
 * Branded OG image rendering for Pitchey.
 *
 * Uses workers-og (Satori + resvg-wasm) to composite 1200×630 PNGs.
 * Fonts come from Google Fonts at runtime (loadGoogleFont caches 1h via the
 * Cache API), so we don't ship binary font data in the bundle.
 *
 * Failure path: callers should catch and serve a 302 to a static fallback.
 */
import { ImageResponse, loadGoogleFont } from 'workers-og';

// Brand colors — kept in sync with tailwind.config.js brand.portal-* tokens.
// Per the portal-colors memory, do NOT introduce a local color-lookup function;
// these constants are the only place the values appear in this file.
const BRAND_CREATOR = '#7B3FBF';
const BRAND_INVESTOR = '#5B4FC7';
const GRADIENT_BG = `linear-gradient(135deg, ${BRAND_INVESTOR} 0%, ${BRAND_CREATOR} 100%)`;

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
};

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ));
}

async function loadFonts() {
  const [bold, regular] = await Promise.all([
    loadGoogleFont({ family: 'Inter', weight: 700 }),
    loadGoogleFont({ family: 'Inter', weight: 400 }),
  ]);
  return [
    { name: 'Inter', data: bold, weight: 700 as const, style: 'normal' as const },
    { name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const },
  ];
}

export interface PortfolioCardProps {
  creatorName: string;
  username: string | null;
  avatarUrl: string | null;
  pitchCount: number;
}

export async function renderPortfolioCard(p: PortfolioCardProps): Promise<Response> {
  const initials = (p.creatorName || '?').trim().charAt(0).toUpperCase();
  const pitchWord = p.pitchCount === 1 ? 'pitch' : 'pitches';

  // Minimal first — every div with >1 child explicitly display:flex.
  const html =
    `<div style="display:flex;flex-direction:column;justify-content:center;align-items:flex-start;width:1200px;height:630px;padding:80px;background:${GRADIENT_BG};font-family:Inter;color:white;">` +
      `<div style="display:flex;font-size:56px;font-weight:700;margin-bottom:16px;">${escapeHtml(p.creatorName)}</div>` +
      `<div style="display:flex;font-size:28px;opacity:0.9;margin-bottom:24px;">${p.pitchCount} ${pitchWord} on Pitchey</div>` +
      `<div style="display:flex;font-size:26px;font-weight:700;opacity:0.7;">Pitchey</div>` +
    `</div>`;

  const fonts = await loadFonts();
  return new ImageResponse(html, {
    width: 1200,
    height: 630,
    fonts,
    headers: CACHE_HEADERS,
  });
}

export interface SlateCardProps {
  title: string;
  creatorName: string;
  pitchCount: number;
  coverImageUrl: string | null;
}

export async function renderSlateCard(p: SlateCardProps): Promise<Response> {
  const pitchWord = p.pitchCount === 1 ? 'pitch' : 'pitches';

  const html =
    `<div style="display:flex;flex-direction:column;justify-content:flex-end;width:1200px;height:630px;padding:80px;background:${GRADIENT_BG};font-family:Inter;color:white;">` +
      `<div style="display:flex;font-size:22px;font-weight:700;letter-spacing:0.06em;margin-bottom:24px;opacity:0.8;">SLATE · ${p.pitchCount} ${pitchWord}</div>` +
      `<div style="display:flex;font-size:72px;font-weight:700;line-height:1.05;margin-bottom:24px;">${escapeHtml(p.title)}</div>` +
      `<div style="display:flex;font-size:30px;opacity:0.9;">by ${escapeHtml(p.creatorName)}</div>` +
    `</div>`;

  const fonts = await loadFonts();
  return new ImageResponse(html, {
    width: 1200,
    height: 630,
    fonts,
    headers: CACHE_HEADERS,
  });
}
