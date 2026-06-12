/**
 * LogoLoader — Pitchey "running film" loading animation.
 *
 * A crisp SVG film-strip (sprocket holes + translucent frame windows) that scrolls
 * vertically in a seamless loop, evoking film running through a projector gate.
 * Reusable anywhere a loading state is needed: route Suspense fallbacks, button
 * spinners, full-page splash, etc.
 *
 * Implementation: the element repeats a single film tile (`background-repeat: repeat-y`)
 * and the `.pitchey-film-anim` class (see index.css) scrolls the background by exactly
 * one tile height (`--film-tile`), so the loop is seamless at any size. Honors
 * `prefers-reduced-motion`.
 */

interface LogoLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  /** Optional caption rendered under the strip (also improves a11y). */
  label?: string;
  className?: string;
}

const DIMS = {
  sm: { w: 26, h: 32, tile: 17 },
  md: { w: 40, h: 50, tile: 25 },
  lg: { w: 58, h: 72, tile: 36 },
} as const;

// One film tile: brand-violet body, a darker frame divider, white sprocket holes down
// both edges, and a translucent frame window. preserveAspectRatio='none' lets it stretch
// to the tile box; it repeats vertically to form a continuous strip.
const TILE_SVG = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 26' preserveAspectRatio='none'>` +
    `<rect width='48' height='26' fill='#5B4FC7'/>` +
    `<rect width='48' height='2' fill='#3F2F99'/>` +
    `<rect x='4' y='8' width='7' height='10' rx='2' fill='#ffffff'/>` +
    `<rect x='37' y='8' width='7' height='10' rx='2' fill='#ffffff'/>` +
    `<rect x='15' y='4' width='18' height='18' rx='2' fill='#ffffff' opacity='0.18'/>` +
  `</svg>`
);

export default function LogoLoader({ size = 'md', label, className = '' }: LogoLoaderProps) {
  const d = DIMS[size];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex flex-col items-center gap-2 ${className}`}
    >
      <div
        className="pitchey-film-anim rounded-md ring-1 ring-black/10 shadow-sm"
        style={{
          width: d.w,
          height: d.h,
          // consumed by the @keyframes scroll distance
          ['--film-tile' as string]: `${d.tile}px`,
          backgroundImage: `url("data:image/svg+xml,${TILE_SVG}")`,
          backgroundRepeat: 'repeat-y',
          backgroundSize: `${d.w}px ${d.tile}px`,
        } as React.CSSProperties}
        aria-hidden="true"
      />
      {label && <span className="text-xs font-medium text-gray-500">{label}</span>}
      <span className="sr-only">{label || 'Loading…'}</span>
    </div>
  );
}
