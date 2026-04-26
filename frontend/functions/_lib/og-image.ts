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

  const avatarBlock = p.avatarUrl
    ? `<img src="${escapeHtml(p.avatarUrl)}" width="220" height="220" style="border-radius: 110px; object-fit: cover; border: 6px solid rgba(255,255,255,0.15);" />`
    : `<div style="display: flex; align-items: center; justify-content: center; width: 220px; height: 220px; border-radius: 110px; background: rgba(255,255,255,0.18); color: white; font-size: 110px; font-weight: 700; font-family: 'Inter';">${escapeHtml(initials)}</div>`;

  const html = `
    <div style="display: flex; width: 1200px; height: 630px; padding: 80px; background: ${GRADIENT_BG}; font-family: 'Inter';">
      <div style="display: flex; align-items: center; gap: 56px; width: 100%;">
        ${avatarBlock}
        <div style="display: flex; flex-direction: column; flex: 1; color: white;">
          <div style="font-size: 56px; font-weight: 700; line-height: 1.1; margin-bottom: 12px;">${escapeHtml(p.creatorName)}</div>
          ${p.username ? `<div style="font-size: 24px; opacity: 0.7; margin-bottom: 24px;">@${escapeHtml(p.username)}</div>` : '<div style="height: 24px; margin-bottom: 24px;"></div>'}
          <div style="font-size: 28px; opacity: 0.9;">${p.pitchCount} ${pitchWord} on Pitchey</div>
        </div>
      </div>
      <div style="position: absolute; bottom: 60px; right: 80px; display: flex; align-items: center; gap: 12px; color: white; font-size: 26px; font-weight: 700; letter-spacing: -0.02em;">
        Pitchey
      </div>
    </div>
  `;

  const fonts = await loadFonts();
  const res = new ImageResponse(html, {
    width: 1200,
    height: 630,
    fonts,
  });
  return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...CACHE_HEADERS } });
}

export interface SlateCardProps {
  title: string;
  creatorName: string;
  pitchCount: number;
  coverImageUrl: string | null;
}

export async function renderSlateCard(p: SlateCardProps): Promise<Response> {
  const pitchWord = p.pitchCount === 1 ? 'pitch' : 'pitches';

  // Background: cover image with dark gradient overlay; fallback to brand gradient.
  const bgStyle = p.coverImageUrl
    ? `background-image: linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.85) 100%), url('${escapeHtml(p.coverImageUrl)}'); background-size: cover; background-position: center;`
    : `background: ${GRADIENT_BG};`;

  const html = `
    <div style="display: flex; flex-direction: column; justify-content: flex-end; width: 1200px; height: 630px; padding: 80px; ${bgStyle} font-family: 'Inter'; color: white;">
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 32px;">
        <div style="display: flex; padding: 10px 22px; border-radius: 999px; background: rgba(255,255,255,0.15); font-size: 22px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;">Slate</div>
        <div style="font-size: 22px; opacity: 0.85;">${p.pitchCount} ${pitchWord}</div>
      </div>
      <div style="font-size: 76px; font-weight: 700; line-height: 1.05; letter-spacing: -0.02em; margin-bottom: 24px; max-width: 1040px;">${escapeHtml(p.title)}</div>
      <div style="font-size: 30px; opacity: 0.9; font-weight: 400;">by ${escapeHtml(p.creatorName)}</div>
      <div style="position: absolute; top: 60px; right: 80px; display: flex; align-items: center; gap: 12px; color: white; font-size: 26px; font-weight: 700; letter-spacing: -0.02em;">
        Pitchey
      </div>
    </div>
  `;

  const fonts = await loadFonts();
  const res = new ImageResponse(html, {
    width: 1200,
    height: 630,
    fonts,
  });
  return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...CACHE_HEADERS } });
}
