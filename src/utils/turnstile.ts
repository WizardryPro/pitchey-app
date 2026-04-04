/**
 * Cloudflare Turnstile server-side verification
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes': string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * Verify a Turnstile token server-side.
 * Returns true if verification succeeds or if Turnstile is not configured (graceful degradation).
 */
export async function verifyTurnstileToken(
  token: string | undefined,
  secretKey: string | undefined,
  remoteIp?: string
): Promise<{ success: boolean; error?: string }> {
  // Skip verification if secret key is not configured (dev/local environments)
  if (!secretKey) {
    return { success: true };
  }

  // Reject if token is missing when Turnstile is configured
  if (!token) {
    return { success: false, error: 'Turnstile verification required' };
  }

  try {
    const body: Record<string, string> = {
      secret: secretKey,
      response: token,
    };
    if (remoteIp) {
      body.remoteip = remoteIp;
    }

    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = await response.json() as TurnstileVerifyResponse;

    if (!result.success) {
      return {
        success: false,
        error: `Turnstile verification failed: ${result['error-codes']?.join(', ') || 'unknown error'}`,
      };
    }

    return { success: true };
  } catch {
    // Network error calling Turnstile API — fail open to avoid blocking legitimate users
    console.error('Turnstile verification request failed');
    return { success: true };
  }
}
