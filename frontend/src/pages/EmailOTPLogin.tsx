import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail, ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { sessionCache } from '@/store/sessionCache';
import { sessionManager } from '@/lib/session-manager';
import { API_URL } from '@/config';
import { getPortalPath } from '@/utils/navigation';
import { resolvePostLoginRedirect } from '@/utils/postLoginRedirect';

type Step = 'email' | 'code';

export default function EmailOTPLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const rawFrom = (location.state as { from?: unknown } | null)?.from;
  const setUser = useBetterAuthStore((s) => s.setUser);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => codeInputRef.current?.focus(), 100);
    }
  }, [step]);

  const handleSendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/email-otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send code');
      }
      setChallengeId(data.challengeId);
      setStep('code');
      toast.success('Code sent to your email');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (submittedCode?: string) => {
    const codeToVerify = submittedCode || code;
    if (!codeToVerify || codeToVerify.length !== 6) return;

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/email-otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ challengeId, code: codeToVerify }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Invalid code');
        setCode('');
        codeInputRef.current?.focus();
        return;
      }

      // Session created
      const user = data.user;
      sessionCache.set(user);
      sessionManager.updateCache(user);
      setUser(user);
      toast.success('Signed in successfully');
      navigate(resolvePostLoginRedirect(rawFrom, `/${getPortalPath(user.userType)}/dashboard`), { replace: true });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) {
      handleVerifyCode(digits);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white py-8 px-6 shadow-xl rounded-lg border border-gray-200">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-purple-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Sign in with Email</h1>
            <p className="text-gray-600 mt-2">
              {step === 'email'
                ? 'Enter your email to receive a sign-in code'
                : `We sent a 6-digit code to ${email}`}
            </p>
          </div>

          {/* Step 1: Email */}
          {step === 'email' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  autoFocus
                  required
                  disabled={loading}
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send Code <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Step 2: Code */}
          {step === 'code' && (
            <div className="space-y-4">
              <input
                ref={codeInputRef}
                type="text"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyCode(); }}
                placeholder="000000"
                className={`w-full text-center text-2xl tracking-[0.5em] px-4 py-4 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono ${
                  error ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                disabled={loading}
              />

              {error && <p className="text-sm text-red-600 text-center">{error}</p>}

              <button
                onClick={() => handleVerifyCode()}
                disabled={loading || code.length !== 6}
                className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 font-medium"
              >
                {loading ? 'Verifying...' : 'Sign In'}
              </button>

              <div className="flex justify-between text-sm">
                <button
                  onClick={() => { setStep('email'); setCode(''); setError(''); }}
                  className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" /> Change email
                </button>
                <button
                  onClick={() => handleSendCode()}
                  disabled={loading}
                  className="text-purple-600 hover:text-purple-700"
                >
                  Resend code
                </button>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="mt-6 mb-4 flex items-center gap-3">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-sm text-gray-400">or</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          {/* Back to password login */}
          <div className="text-center">
            <Link
              to="/portals"
              className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1 justify-center"
            >
              <ArrowLeft className="w-4 h-4" /> Sign in with password
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
