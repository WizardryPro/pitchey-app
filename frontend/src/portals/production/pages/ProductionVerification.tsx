import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, CheckCircle, XCircle, AlertTriangle, Clock,
  Upload, Building2, RefreshCw,
} from 'lucide-react';
import CompaniesHouseAutocomplete, {
  type CompaniesHouseResult,
} from '../components/CompaniesHouseAutocomplete';

const API_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Region = 'USA' | 'UK' | 'IRE' | 'CAN' | 'AUS' | 'NZ' | 'REST';

type CheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

interface AutoCheck {
  name: string;
  status: CheckStatus;
  message: string;
}

interface Verification {
  id: string;
  status: 'pending' | 'approved' | 'auto_approved' | 'rejected';
  companyName: string;
  region: Region;
  websiteUrl: string;
  rejectionReason?: string;
  autoChecks?: AutoCheck[];
  createdAt: string;
  reviewedAt?: string;
}

interface VerificationStatusResponse {
  verified: boolean;
  verification: Verification | null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CheckIcon({ status }: { status: CheckStatus }) {
  switch (status) {
    case 'pass':
      return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />;
    case 'fail':
      return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
    case 'warn':
      return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />;
    case 'skip':
      return <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />;
  }
}

function AutoCheckRow({ check }: { check: AutoCheck }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
      <CheckIcon status={check.status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{check.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{check.message}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status views
// ---------------------------------------------------------------------------

function PendingView({
  verification,
  onRefresh,
  refreshing,
}: {
  verification: Verification;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <Clock className="w-6 h-6 text-yellow-500 shrink-0" />
        <div>
          <p className="font-semibold text-yellow-800">Under Review</p>
          <p className="text-sm text-yellow-700 mt-0.5">
            Your verification submission is being reviewed by the Pitchey team. This usually takes
            1–2 business days.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Submission Details
        </p>
        <Detail label="Company" value={verification.companyName} />
        <Detail label="Region" value={verification.region} />
        <Detail label="Website" value={verification.websiteUrl} />
        <Detail
          label="Submitted"
          value={new Date(verification.createdAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        />
      </div>

      {verification.autoChecks && verification.autoChecks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Automated Checks
          </p>
          {verification.autoChecks.map((check, i) => (
            <AutoCheckRow key={i} check={check} />
          ))}
        </div>
      )}

      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        {refreshing ? 'Checking...' : 'Check for updates'}
      </button>
    </div>
  );
}

function ApprovedView({ verification }: { verification: Verification }) {
  const isAuto = verification.status === 'auto_approved';
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
        <Shield className="w-6 h-6 text-green-600 shrink-0" />
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-green-800">Verified</p>
            {isAuto && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                Auto-approved
              </span>
            )}
          </div>
          <p className="text-sm text-green-700 mt-0.5">
            {verification.companyName} has been verified as a legitimate production company on
            Pitchey. You can now purchase credits and view pitches.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Verified Details
        </p>
        <Detail label="Company" value={verification.companyName} />
        <Detail label="Region" value={verification.region} />
        <Detail label="Website" value={verification.websiteUrl} />
        {verification.reviewedAt && (
          <Detail
            label="Approved on"
            value={new Date(verification.reviewedAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          />
        )}
      </div>

      {verification.autoChecks && verification.autoChecks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Automated Checks
          </p>
          {verification.autoChecks.map((check, i) => (
            <AutoCheckRow key={i} check={check} />
          ))}
        </div>
      )}
    </div>
  );
}

function RejectedView({
  verification,
  onResubmit,
}: {
  verification: Verification;
  onResubmit: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
        <XCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-800">Verification Rejected</p>
          {verification.rejectionReason && (
            <p className="text-sm text-red-700 mt-1">{verification.rejectionReason}</p>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Please review the reason above and resubmit with the correct information.
      </p>

      <button
        onClick={onResubmit}
        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-portal-production text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Resubmit Verification
      </button>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium text-right max-w-xs truncate">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ProductionVerification() {
  const [statusData, setStatusData] = useState<VerificationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [region, setRegion] = useState<Region>('USA');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [chSearchQuery, setChSearchQuery] = useState('');
  const [chSelected, setChSelected] = useState<CompaniesHouseResult | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [noCompanyNumber, setNoCompanyNumber] = useState(false);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const res = await fetch(`${API_URL}/api/production/verification-status`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: VerificationStatusResponse = await res.json();
      setStatusData(data);
      setError(null);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, []);

  const regionLabel: Record<Region, string> = {
    USA: 'EIN',
    UK: 'Companies House Number',
    IRE: 'CRO Number',
    CAN: 'Corporation Number',
    AUS: 'ACN (Australian Company Number)',
    NZ: 'NZBN (NZ Business Number)',
    REST: 'Local Registration Number',
  };

  const regionPlaceholder: Record<Region, string> = {
    USA: 'XX-XXXXXXX',
    UK: '12345678',
    IRE: 'e.g. 123456',
    CAN: 'e.g. 1234567-8',
    AUS: 'e.g. 123 456 789',
    NZ: 'e.g. 9429041234567',
    REST: 'e.g. REG-123456',
  };

  const backendRegion: Record<Region, string> = {
    USA: 'usa',
    UK: 'uk',
    IRE: 'other',
    CAN: 'other',
    AUS: 'other',
    NZ: 'other',
    REST: 'other',
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setFormError('Insurance document must be a PDF, JPG, or PNG file.');
      return;
    }
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      setFormError('Insurance document must be under 10 MB.');
      return;
    }
    setFormError(null);
    setInsuranceFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!companyName.trim()) {
      setFormError('Company name is required.');
      return;
    }
    if (!websiteUrl.trim()) {
      setFormError('Website URL is required.');
      return;
    }
    if (noCompanyNumber && !insuranceFile) {
      setFormError('Please upload proof of insurance when no company registration number is provided.');
      return;
    }

    setSubmitting(true);
    try {
      // If insurance upload is needed, do that first
      if (noCompanyNumber && insuranceFile) {
        const uploadRes = await fetch(`${API_URL}/api/production/verify/upload-insurance`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': insuranceFile.type },
          body: insuranceFile,
        });
        if (!uploadRes.ok) {
          const body = await uploadRes.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `Upload failed (HTTP ${uploadRes.status})`);
        }
      }

      const payload: Record<string, unknown> = {
        companyName: companyName.trim(),
        region: backendRegion[region],
        websiteUrl: websiteUrl.trim(),
        hasCompanyNumber: !noCompanyNumber,
      };
      if (!noCompanyNumber && registrationNumber.trim()) {
        if (region === 'USA') payload['ein'] = registrationNumber.trim();
        else payload['companyNumber'] = registrationNumber.trim();
      }

      const res = await fetch(`${API_URL}/api/production/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Submission failed (HTTP ${res.status})`);
      }

      await fetchStatus();
      setShowForm(false);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCompanyName('');
    setRegion('USA');
    setRegistrationNumber('');
    setWebsiteUrl('');
    setNoCompanyNumber(false);
    setInsuranceFile(null);
    setFormError(null);
    setShowForm(true);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const verification = statusData?.verification ?? null;

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Failed to load verification status: {error}
        </div>
      );
    }

    if (!verification || showForm) {
      return VerificationForm();
    }

    switch (verification.status) {
      case 'pending':
        return (
          <PendingView
            verification={verification}
            onRefresh={() => void fetchStatus(true)}
            refreshing={refreshing}
          />
        );
      case 'approved':
      case 'auto_approved':
        return <ApprovedView verification={verification} />;
      case 'rejected':
        return <RejectedView verification={verification} onResubmit={resetForm} />;
      default:
        return VerificationForm();
    }
  };

  function VerificationForm() {
    return (
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {formError}
          </div>
        )}

        {/* Company Name */}
        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
            Company Name <span className="text-red-500">*</span>
          </label>
          <input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            placeholder="Acme Productions Ltd."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-portal-production/30 focus:border-brand-portal-production"
          />
        </div>

        {/* Region */}
        <div>
          <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">
            Region
          </label>
          <select
            id="region"
            value={region}
            onChange={(e) => {
              setRegion(e.target.value as Region);
              setRegistrationNumber('');
              setChSelected(null);
              setChSearchQuery('');
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-portal-production/30 focus:border-brand-portal-production bg-white"
          >
            <option value="USA">USA</option>
            <option value="UK">UK</option>
            <option value="IRE">Ireland</option>
            <option value="CAN">Canada</option>
            <option value="AUS">Australia</option>
            <option value="NZ">New Zealand</option>
            <option value="REST">Rest of World</option>
          </select>
        </div>

        {/* Registration number — hidden when no company number checked.
            UK uses the live Companies House autocomplete; other regions
            stay as a plain text input (no equivalent public search API). */}
        {!noCompanyNumber && (
          region === 'UK' ? (
            <div>
              <CompaniesHouseAutocomplete
                value={chSelected ? `${chSelected.title} (#${chSelected.companyNumber})` : chSearchQuery}
                onChange={(v) => {
                  setChSearchQuery(v);
                  if (chSelected) {
                    // user is editing again — clear the selection
                    setChSelected(null);
                    setRegistrationNumber('');
                  }
                }}
                onSelect={(result) => {
                  setChSelected(result);
                  setRegistrationNumber(result.companyNumber);
                  setCompanyName(result.title);
                  setChSearchQuery('');
                }}
              />
              {chSelected && (
                <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-brand-portal-production/5 border border-brand-portal-production/20 rounded-lg text-xs">
                  <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{chSelected.title}</p>
                    <p className="text-gray-600 mt-0.5">
                      #{chSelected.companyNumber} · {chSelected.status}
                      {chSelected.address && ` · ${chSelected.address}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label
                htmlFor="registrationNumber"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {regionLabel[region]}
              </label>
              <input
                id="registrationNumber"
                type="text"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder={regionPlaceholder[region]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-portal-production/30 focus:border-brand-portal-production"
              />
            </div>
          )
        )}

        {/* No company number checkbox */}
        <div className="flex items-start gap-3">
          <input
            id="noCompanyNumber"
            type="checkbox"
            checked={noCompanyNumber}
            onChange={(e) => {
              setNoCompanyNumber(e.target.checked);
              if (!e.target.checked) setInsuranceFile(null);
            }}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-portal-production focus:ring-brand-portal-production"
          />
          <label htmlFor="noCompanyNumber" className="text-sm text-gray-700">
            I don&apos;t have a company registration number
          </label>
        </div>

        {/* Insurance upload — visible only when checkbox is checked */}
        {noCompanyNumber && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proof of Insurance <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-brand-portal-production/50 hover:text-brand-portal-production transition-colors"
            >
              <Upload className="w-5 h-5" />
              {insuranceFile ? (
                <span className="font-medium text-gray-800">{insuranceFile.name}</span>
              ) : (
                <span>Click to upload PDF, JPG, or PNG (max 10 MB)</span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Upload proof of insurance"
            />
            <p className="mt-2 text-xs text-gray-400">
              * Proof of insurance is only required if you do not have a company registration
              number. This document is reviewed by Pitchey admins only and is never visible to
              other users on the platform.
            </p>
          </div>
        )}

        {/* Website */}
        <div>
          <label htmlFor="websiteUrl" className="block text-sm font-medium text-gray-700 mb-1">
            Company Website <span className="text-red-500">*</span>
          </label>
          <input
            id="websiteUrl"
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            required
            placeholder="https://www.yourcompany.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-portal-production/30 focus:border-brand-portal-production"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-portal-production text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Shield className="w-4 h-4" />
              Submit for Verification
            </>
          )}
        </button>
      </form>
    );
  }

  const isVerified =
    verification?.status === 'approved' || verification?.status === 'auto_approved';

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="p-2 bg-brand-portal-production/10 rounded-lg">
          <Building2 className="w-6 h-6 text-brand-portal-production" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">Company Verification</h1>
            {isVerified && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                <CheckCircle className="w-4 h-4" />
                Verified
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Verify your production company to unlock credits, pitch access, and the full Pitchey
            marketplace.
          </p>
        </div>
      </div>

      {/* Content card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        {renderContent()}
      </div>
    </div>
  );
}
