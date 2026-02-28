import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { UserPlus, Mail, Lock, User, Briefcase, AlertCircle, CheckCircle } from 'lucide-react';


export default function Register() {
  const { register, loading, error } = useBetterAuthStore();
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    userType: 'creator',
    companyName: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      await register({
        email: formData.email,
        username: formData.username,
        password: formData.password,
        userType: formData.userType,
        companyName: formData.companyName,
      });

      // Store email for verification resend if needed
      localStorage.setItem('pendingVerificationEmail', formData.email);

      // Show verification message instead of redirecting
      setRegistrationComplete(true);
    } catch (_error) {
      // Error is handled in the store
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex flex-col items-center">
          <span className="text-4xl font-bold text-purple-600">Pitchey</span>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link
            to={`/login/${formData.userType}`}
            className="font-medium text-primary-600 hover:text-primary-500"
          >
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {registrationComplete ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Registration successful!
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                We've sent a verification email to <strong>{formData.email}</strong>
              </p>
              <p className="text-xs text-gray-500 mb-6">
                Please check your inbox and click the verification link to activate your account.
                The link will expire in 24 hours.
              </p>
              <div className="space-y-3">
                <Link
                  to={`/login/${formData.userType}`}
                  className="block w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                >
                  Go to login
                </Link>
                <Link
                  to="/verify-email"
                  className="block w-full py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Didn't receive email?
                </Link>
              </div>
            </div>
          ) : (
          <form className="space-y-6" onSubmit={(e) => { void handleSubmit(e); }}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-3">
                What brings you to Pitchey?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { value: 'creator', label: 'Creator', desc: 'Pitch your film or TV project' },
                  { value: 'production', label: 'Production', desc: 'Find projects to produce' },
                  { value: 'investor', label: 'Investor', desc: 'Discover investment opportunities' },
                ].map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, userType: type.value })}
                    className={`p-4 text-left rounded-lg border-2 transition ${
                      formData.userType === type.value
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold">{type.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{type.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field pl-10"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="input-field pl-10"
                  placeholder="johndoe"
                />
              </div>
            </div>

            {formData.userType !== 'creator' && (
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                  Company Name (Optional)
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Briefcase className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="input-field pl-10"
                    placeholder="Acme Productions"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-field pl-10"
                  placeholder="••••••••"
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Must be at least 8 characters
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="input-field pl-10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-start">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                required
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="terms" className="ml-2 block text-sm text-gray-900">
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-500 underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-500 underline">
                  Privacy Policy
                </a>
              </label>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center btn-primary"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <UserPlus className="h-5 w-5 mr-2" />
                    Create account
                  </>
                )}
              </button>
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}