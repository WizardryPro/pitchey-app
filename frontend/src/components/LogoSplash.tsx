/**
 * LogoSplash — the elevated, full-page loading moment for app boot / route splashes.
 *
 * Same film-strip DNA as LogoLoader, dialed up for big moments: the strip runs at a
 * calmer pace inside a "projector gate" (framed card + a faint light flicker), with the
 * Pitchey wordmark and a contextual caption fading up beneath it. Everywhere else keeps
 * the bare LogoLoader strip — one identity, more polish only where it counts.
 *
 * Honors prefers-reduced-motion (see index.css).
 */
import Logo from './Logo';
import LogoLoader from './LogoLoader';

interface LogoSplashProps {
  /** Contextual line under the wordmark, e.g. "Preparing your dashboard…". */
  message?: string;
  /** Full-screen overlay (default) vs. an inline centered block. */
  fullScreen?: boolean;
}

export default function LogoSplash({ message = 'Loading…', fullScreen = true }: LogoSplashProps) {
  const inner = (
    <div className="flex flex-col items-center gap-6">
      {/* Projector gate: the running film strip framed with a soft vignette + light flicker. */}
      <div className="relative rounded-2xl bg-white p-3.5 shadow-lg ring-1 ring-black/5">
        <LogoLoader size="lg" speed="slow" />
        <span
          className="pitchey-gate-flicker pointer-events-none absolute inset-0 rounded-2xl"
          aria-hidden="true"
        />
      </div>

      <div className="pitchey-splash-rise flex flex-col items-center gap-2.5">
        <Logo size="md" />
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  );

  if (!fullScreen) return inner;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      {inner}
    </div>
  );
}
