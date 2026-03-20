import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { sessionCache } from '@/store/sessionCache';
import { sessionManager } from '@/lib/session-manager';
import { API_URL } from '@/config';

export default function MFAChallengePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const challengeId = searchParams.get('challengeId');
  const userType = searchParams.get('userType') || 'creator';
  const userName = searchParams.get('name') || '';
  const userEmail = searchParams.get('email') || '';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const setUser = useBetterAuthStore((s) => s.setUser);

  useEffect(() => {
    if (!challengeId) {
      navigate('/login/' + userType, { replace: true });
    }
    inputRef.current?.focus();
  }, [challengeId, navigate, userType]);

  const handleSubmit = async (submittedCode?: string) => {
    const codeToVerify = submittedCode || code;
    if (!codeToVerify || codeToVerify.length !== 6 || !challengeId) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ challengeId, code: codeToVerify }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Invalid code');
        setCode('');
        inputRef.current?.focus();
        return;
      }

      const user = data.user;
      sessionCache.set(user);
      sessionManager.updateCache(user);
      setUser(user);

      toast.success('Verified successfully');
      navigate(`/${user.userType}/dashboard`, { replace: true });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) {
      handleSubmit(digits);
    }
  };

  // Mask email: show first 2 chars + domain
  const maskedEmail = userEmail
    ? userEmail.replace(/^(.{2})(.*)(@.*)$/, '$1***$3')
    : '';

  if (!challengeId) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-purple-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
            {userName && (
              <p className="text-sm text-gray-500 mt-1">Welcome back, {userName}</p>
            )}
            <p className="text-gray-600 mt-2">
              We sent a 6-digit code to {maskedEmail || 'your email'}
            </p>
          </div>

          <div className="space-y-4">
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
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
              onClick={() => handleSubmit()}
              disabled={loading || code.length !== 6}
              className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  Verifying...
                </span>
              ) : (
                'Verify'
              )}
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              Didn't receive the code? Check your spam folder.
            </p>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => navigate(`/login/${userType}`, { replace: true })}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
