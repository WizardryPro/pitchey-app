const BLOCKED_PREFIXES = ['/login', '/portals', '/mfa', '/register', '/forgot-password', '/reset-password'];

const PENDING_KEY = 'pitchey:pendingReturnTo';

export function isSafeReturnPath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//') || value.startsWith('/\\')) return false;
  return !BLOCKED_PREFIXES.some((prefix) => value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}?`));
}

export function getPostLoginRedirect(from: unknown, defaultPath: string): string {
  return isSafeReturnPath(from) ? from : defaultPath;
}

export function setPendingReturnTo(value: unknown): void {
  if (typeof window === 'undefined') return;
  if (!isSafeReturnPath(value)) return;
  try {
    window.localStorage.setItem(PENDING_KEY, value);
  } catch {
    // storage unavailable (private mode, quota); treat as best-effort
  }
}

export function consumePendingReturnTo(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    window.localStorage.removeItem(PENDING_KEY);
    return isSafeReturnPath(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function resolvePostLoginRedirect(stateFrom: unknown, defaultPath: string): string {
  if (isSafeReturnPath(stateFrom)) {
    // explicit state wins; clear any stashed pending so it doesn't leak into a later login
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(PENDING_KEY);
    } catch {
      // ignore
    }
    return stateFrom;
  }
  const pending = consumePendingReturnTo();
  return pending ?? defaultPath;
}
