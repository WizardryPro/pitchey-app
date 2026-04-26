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

  // Avatar block: real image wrapped in a flex container, OR an initials circle.
  // Both branches return a single child div with display:flex.
  const avatarBlock = p.avatarUrl
    ? `<div style="display:flex;width:200px;height:200px;border-radius:100px;overflow:hidden;border:6px solid rgba(255,255,255,0.18);margin-right:48px;flex-shrink:0;">` +
        `<img src="${escapeHtml(p.avatarUrl)}" width="200" height="200" style="object-fit:cover;width:200px;height:200px;" />` +
      `</div>`
    : `<div style="display:flex;align-items:center;justify-content:center;width:200px;height:200px;border-radius:100px;background:rgba(255,255,255,0.18);font-size:96px;font-weight:700;margin-right:48px;flex-shrink:0;">${escapeHtml(initials)}</div>`;

  const usernameLine = p.username
    ? `<div style="display:flex;font-size:24px;opacity:0.7;margin-bottom:20px;">@${escapeHtml(p.username)}</div>`
    : '';

  // No whitespace between sibling tags — Satori counts whitespace text nodes
  // as children, which trips the "div with >1 child needs display:flex" rule.
  const html =
    `<div style="display:flex;align-items:center;width:1200px;height:630px;padding:80px;background:${GRADIENT_BG};font-family:Inter;color:white;">` +
      avatarBlock +
      `<div style="display:flex;flex-direction:column;flex:1;">` +
        `<div style="display:flex;font-size:56px;font-weight:700;line-height:1.1;margin-bottom:12px;">${escapeHtml(p.creatorName)}</div>` +
        usernameLine +
        `<div style="display:flex;font-size:28px;opacity:0.9;margin-bottom:32px;">${p.pitchCount} ${pitchWord} on Pitchey</div>` +
        `<div style="display:flex;font-size:24px;font-weight:700;opacity:0.6;letter-spacing:-0.02em;">Pitchey</div>` +
      `</div>` +
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

  // If we have a cover image, layer the brand gradient over it as a dark
  // overlay so the title stays readable. Without a cover, fall back to the
  // brand gradient solo.
  const bg = p.coverImageUrl
    ? `linear-gradient(180deg,rgba(0,0,0,0.25) 0%,rgba(0,0,0,0.85) 100%),url('${escapeHtml(p.coverImageUrl)}')`
    : GRADIENT_BG;
  const bgSize = p.coverImageUrl ? 'background-size:cover;background-position:center;' : '';

  const html =
    `<div style="display:flex;flex-direction:column;justify-content:flex-end;width:1200px;height:630px;padding:80px;background:${bg};${bgSize}font-family:Inter;color:white;">` +
      `<div style="display:flex;font-size:22px;font-weight:700;letter-spacing:0.06em;margin-bottom:24px;opacity:0.85;">SLATE · ${p.pitchCount} ${pitchWord}</div>` +
      `<div style="display:flex;font-size:72px;font-weight:700;line-height:1.05;margin-bottom:24px;">${escapeHtml(p.title)}</div>` +
      `<div style="display:flex;justify-content:space-between;align-items:flex-end;">` +
        `<div style="display:flex;font-size:30px;opacity:0.9;">by ${escapeHtml(p.creatorName)}</div>` +
        `<div style="display:flex;font-size:24px;font-weight:700;opacity:0.6;letter-spacing:-0.02em;">Pitchey</div>` +
      `</div>` +
    `</div>`;

  const fonts = await loadFonts();
  return new ImageResponse(html, {
    width: 1200,
    height: 630,
    fonts,
    headers: CACHE_HEADERS,
  });
}

export interface PitchCardProps {
  title: string;
  logline: string | null;
  genre: string | null;
  creatorName: string;
  coverImageUrl: string | null;
}

export async function renderPitchCard(p: PitchCardProps): Promise<Response> {
  // Layered background: brand gradient under cover image with darker overlay
  // for legibility (loglines are long).
  const bg = p.coverImageUrl
    ? `linear-gradient(180deg,rgba(0,0,0,0.30) 0%,rgba(0,0,0,0.88) 100%),url('${escapeHtml(p.coverImageUrl)}')`
    : GRADIENT_BG;
  const bgSize = p.coverImageUrl ? 'background-size:cover;background-position:center;' : '';

  const genreBadge = p.genre
    ? `<div style="display:flex;padding:8px 18px;border-radius:999px;background:rgba(255,255,255,0.18);font-size:20px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;margin-right:16px;">${escapeHtml(p.genre)}</div>`
    : '';

  // Loglines run long; clamp ~180 chars so they don't overflow the card.
  const logline = (p.logline || '').trim();
  const cappedLogline = logline.length > 180 ? logline.slice(0, 179).trimEnd() + '…' : logline;
  const loglineBlock = cappedLogline
    ? `<div style="display:flex;font-size:26px;line-height:1.3;opacity:0.92;margin-bottom:32px;max-width:1040px;">${escapeHtml(cappedLogline)}</div>`
    : '';

  const html =
    `<div style="display:flex;flex-direction:column;justify-content:flex-end;width:1200px;height:630px;padding:80px;background:${bg};${bgSize}font-family:Inter;color:white;">` +
      `<div style="display:flex;align-items:center;margin-bottom:24px;">` +
        genreBadge +
        `<div style="display:flex;font-size:20px;font-weight:700;letter-spacing:0.06em;opacity:0.7;text-transform:uppercase;">PITCH</div>` +
      `</div>` +
      `<div style="display:flex;font-size:64px;font-weight:700;line-height:1.05;letter-spacing:-0.02em;margin-bottom:20px;max-width:1040px;">${escapeHtml(p.title)}</div>` +
      loglineBlock +
      `<div style="display:flex;justify-content:space-between;align-items:flex-end;">` +
        `<div style="display:flex;font-size:26px;opacity:0.9;">by ${escapeHtml(p.creatorName)}</div>` +
        `<div style="display:flex;font-size:24px;font-weight:700;opacity:0.6;letter-spacing:-0.02em;">Pitchey</div>` +
      `</div>` +
    `</div>`;

  const fonts = await loadFonts();
  return new ImageResponse(html, {
    width: 1200,
    height: 630,
    fonts,
    headers: CACHE_HEADERS,
  });
}
