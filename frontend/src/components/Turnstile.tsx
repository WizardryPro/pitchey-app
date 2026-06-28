import { useEffect, useRef, useCallback, useState } from 'react';
import { AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: TurnstileOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

interface TurnstileOptions {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback'?: () => void;
  // Cloudflare passes an error code string (e.g. "600010" = hostname not allowed).
  'error-callback'?: (errorCode?: string) => void;
  // Silently re-solve when the token expires (~5 min) instead of going stale, and
  // auto-retry transient failures — kills most "TURNSTILE_FAILED" 403s on submit.
  'refresh-expired'?: 'auto' | 'manual' | 'never';
  'retry'?: 'auto' | 'never';
  'retry-interval'?: number;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'invisible';
}

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  // Called when the widget fails to issue a token (network/config error). Receives
  // Cloudflare's error code when available.
  onError?: (errorCode?: string) => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
  className?: string;
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
const SCRIPT_ID = 'cf-turnstile-script';

// True only when a Turnstile site key is configured (i.e. the widget actually renders
// and must issue a token). False in tests/local dev with no key, so auth forms aren't
// blocked when there is no challenge to complete.
export const TURNSTILE_ENABLED = !!SITE_KEY;

function loadScript(): Promise<void> {
  if (document.getElementById(SCRIPT_ID)) {
    return window.turnstile
      ? Promise.resolve()
      : new Promise((resolve) => { window.onTurnstileLoad = resolve; });
  }

  return new Promise((resolve) => {
    window.onTurnstileLoad = resolve;
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
    script.async = true;
    document.head.appendChild(script);
  });
}

export default function Turnstile({ onVerify, onExpire, onError, theme = 'auto', size = 'normal', className }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  // Holds Cloudflare's error code when the widget fails so we can show the user a
  // visible, diagnosable message instead of a silently-disabled Sign in button.
  const [errorCode, setErrorCode] = useState<string | null>(null);

  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return;

    let mounted = true;

    void loadScript().then(() => {
      if (!mounted || !containerRef.current || !window.turnstile) return;

      // Clear any previous widget
      if (widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: (token: string) => {
          setErrorCode(null);
          onVerifyRef.current(token);
        },
        'expired-callback': () => onExpireRef.current?.(),
        'error-callback': (code?: string) => {
          setErrorCode(code || 'unknown');
          onErrorRef.current?.(code);
          // Keep the token cleared so the gated Sign in button stays disabled.
          onExpireRef.current?.();
        },
        // Re-issue a fresh token on expiry/transient error before the user submits,
        // so a token that sat idle never reaches the server stale.
        'refresh-expired': 'auto',
        'retry': 'auto',
        theme,
        size,
      });
    });

    return () => {
      mounted = false;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [theme, size]);

  if (!SITE_KEY) return null;

  return (
    <div className={className}>
      <div ref={containerRef} />
      {errorCode && (
        <div role="alert" className="mt-2 flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            Security check failed (error {errorCode}). Refresh the page and try again — if it
            keeps happening, contact support with this code.
          </span>
        </div>
      )}
    </div>
  );
}

export function useTurnstileReset() {
  const widgetIdRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  return { reset, widgetIdRef };
}
