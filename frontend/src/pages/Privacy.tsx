import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <button
          onClick={() => { void navigate('/'); }}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-500 mb-8">Last updated: February 23, 2026</p>

          <div className="prose prose-gray max-w-none space-y-8">

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-600 mb-4">
                Pitchey Ltd (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and safeguard your personal information and uploaded content when you use the Pitchey platform (&quot;the Platform&quot;).
              </p>
              <p className="text-gray-600 mb-4">
                This policy should be read alongside our <Link to="/terms" className="text-purple-600 hover:text-purple-500 underline">Terms of Service</Link>. By using the Platform, you consent to the practices described in this policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">2.1 Account Information</h3>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li>Name, email address, and account credentials</li>
                <li>Account type (creator, investor, or production company)</li>
                <li>Profile information (bio, company name, professional background)</li>
                <li>Email verification status</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">2.2 Uploaded Content</h3>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li>Pitch materials: titles, loglines, synopses, scripts, pitch decks</li>
                <li>Media files: images, videos, audio, and documents</li>
                <li>Character breakdowns, budget information, and project timelines</li>
                <li>NDA documents and signed agreements</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">2.3 Transaction Information</h3>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li>Credit purchase and usage history</li>
                <li>Subscription status and billing records</li>
                <li>Investment expressions of interest and portfolio data</li>
                <li>Payment method details (processed and stored by Stripe; we do not store full card numbers)</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">2.4 Communications</h3>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li>In-platform messages between users</li>
                <li>File attachments shared via messaging</li>
                <li>NDA request and approval correspondence</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">2.5 Technical Information</h3>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li>IP address, browser type, and device information</li>
                <li>Pages viewed, features used, and timestamps</li>
                <li>Session cookies for authentication (see Section 8)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-600 mb-4">We use your information to:</p>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li><strong>Provide the service:</strong> Manage your account, display pitches, facilitate connections between users, process NDA workflows, and manage credits</li>
                <li><strong>Process payments:</strong> Handle credit purchases, subscriptions, and refunds through our payment processor (Stripe)</li>
                <li><strong>Communicate with you:</strong> Send transactional emails (verification, password resets, NDA notifications, investment updates) from noreply@pitchey.com</li>
                <li><strong>Maintain security:</strong> Detect and prevent fraud, enforce our Terms, and protect the integrity of uploaded content</li>
                <li><strong>Improve the Platform:</strong> Analyse usage patterns (in aggregate) to improve features and performance</li>
                <li><strong>Legal compliance:</strong> Fulfil legal obligations, respond to lawful requests, and resolve disputes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. How We Store and Protect Your Data</h2>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">4.1 Infrastructure</h3>
              <p className="text-gray-600 mb-4">Your data is stored using the following infrastructure:</p>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li><strong>Application logic:</strong> Cloudflare Workers (edge computing, globally distributed)</li>
                <li><strong>Database:</strong> Neon PostgreSQL (encrypted at rest and in transit)</li>
                <li><strong>File storage:</strong> Cloudflare R2 (encrypted object storage for documents, media, and NDAs)</li>
                <li><strong>Caching:</strong> Upstash Redis (ephemeral, no personal data persisted)</li>
                <li><strong>Payments:</strong> Stripe (PCI DSS Level 1 compliant)</li>
                <li><strong>Email:</strong> Resend (transactional emails only)</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">4.2 Security Measures</h3>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li>All data transmitted over HTTPS/TLS encryption</li>
                <li>Passwords hashed using PBKDF2 with 100,000 iterations (SHA-256)</li>
                <li>Session-based authentication using secure, HTTP-only cookies</li>
                <li>Access controls enforce role-based permissions across all three portals</li>
                <li>Uploaded files stored in isolated, encrypted storage buckets</li>
                <li>Regular security scanning via CodeQL, Semgrep, and dependency auditing in our CI pipeline</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">4.3 Confidential Content</h3>
              <p className="text-gray-600 mb-4">
                We recognise that creators upload highly sensitive and commercially valuable materials. NDA-protected content is access-controlled at the application level: only users who have signed the required NDA can view protected pitch details. We do not access, read, or use your uploaded content for any purpose other than providing the Platform&apos;s services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Information Sharing</h2>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">5.1 With Other Users</h3>
              <p className="text-gray-600 mb-4">
                When you publish a pitch, certain information (title, genre, logline, your name) becomes visible to other registered users. Detailed materials (full script, budget, character breakdowns) are only shared with users who have signed the applicable NDA, if one is required by the creator.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">5.2 Service Providers</h3>
              <p className="text-gray-600 mb-4">We share limited data with trusted third-party providers:</p>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li><strong>Stripe:</strong> Payment processing (name, email, payment method)</li>
                <li><strong>Resend:</strong> Transactional email delivery (email address, name)</li>
                <li><strong>Cloudflare:</strong> Infrastructure provider (request metadata, IP addresses)</li>
              </ul>
              <p className="text-gray-600 mb-4">
                These providers are bound by their own privacy policies and data processing agreements. We do not sell your personal data to any third party.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">5.3 Legal Requirements</h3>
              <p className="text-gray-600 mb-4">
                We may disclose your information if required to do so by law, court order, or government request, or if we believe disclosure is necessary to protect our rights, your safety, or the safety of others.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Your Rights</h2>
              <p className="text-gray-600 mb-4">Depending on your jurisdiction, you may have the following rights:</p>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">6.1 Access</h3>
              <p className="text-gray-600 mb-4">
                You can view and download your personal data and uploaded content through your account settings at any time.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">6.2 Correction</h3>
              <p className="text-gray-600 mb-4">
                You can update your profile information and account details through your settings page.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">6.3 Deletion</h3>
              <p className="text-gray-600 mb-4">
                You may request deletion of your account and all associated data. Upon deletion:
              </p>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li>Profile data and uploaded content will be removed within 30 days</li>
                <li>Transaction records may be retained for up to 7 years for regulatory compliance</li>
                <li>NDA records involving other parties may be retained to protect the other party&apos;s interests</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">6.4 Data Portability</h3>
              <p className="text-gray-600 mb-4">
                You may request an export of your personal data in a machine-readable format by contacting us at <a href="mailto:privacy@pitchey.com" className="text-purple-600 hover:text-purple-500 underline">privacy@pitchey.com</a>.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">6.5 Objection and Restriction</h3>
              <p className="text-gray-600 mb-4">
                You may object to certain processing of your data or request that we restrict processing in specific circumstances. Contact us to exercise these rights.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Data Retention</h2>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li><strong>Account data:</strong> Retained while your account is active, deleted within 30 days of account closure</li>
                <li><strong>Uploaded content:</strong> Retained while your account is active, permanently deleted within 30 days of account closure</li>
                <li><strong>Messages:</strong> Retained for the duration of the conversation participants&apos; accounts</li>
                <li><strong>Transaction records:</strong> Retained for up to 7 years for legal/financial compliance</li>
                <li><strong>NDA records:</strong> Retained for the duration of the NDA terms or as required by law</li>
                <li><strong>Server logs:</strong> Retained for up to 90 days for security and debugging purposes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Cookies and Session Management</h2>
              <p className="text-gray-600 mb-4">
                We use a minimal set of cookies strictly necessary for the Platform to function:
              </p>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li><strong>Session cookie (pitchey-session):</strong> Maintains your authenticated session. This is an HTTP-only, secure cookie that cannot be accessed by JavaScript. It is essential for the Platform to function and cannot be disabled.</li>
                <li><strong>No third-party tracking cookies:</strong> We do not use advertising cookies, social media trackers, or third-party analytics cookies</li>
                <li><strong>No cross-site tracking:</strong> Our cookies are first-party only and are not shared with external services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Children&apos;s Privacy</h2>
              <p className="text-gray-600 mb-4">
                The Platform is intended for users aged 18 and over. We do not knowingly collect personal information from anyone under 18. If we learn that we have collected data from a minor, we will delete it promptly.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. International Data Transfers</h2>
              <p className="text-gray-600 mb-4">
                Your data may be processed in multiple countries due to our use of globally distributed infrastructure (Cloudflare Workers). We ensure that data transfers comply with applicable data protection laws. Where data is transferred outside the European Economic Area (EEA), we rely on standard contractual clauses or other approved transfer mechanisms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. GDPR (European Users)</h2>
              <p className="text-gray-600 mb-4">
                If you are located in the European Economic Area, the United Kingdom, or Switzerland, you have additional rights under the General Data Protection Regulation (GDPR):
              </p>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li><strong>Legal basis for processing:</strong> We process your data based on contractual necessity (to provide the service), legitimate interest (to improve the Platform and maintain security), and consent (for optional communications)</li>
                <li><strong>Data Protection Officer:</strong> Contact us at <a href="mailto:privacy@pitchey.com" className="text-purple-600 hover:text-purple-500 underline">privacy@pitchey.com</a> for data protection enquiries</li>
                <li><strong>Right to lodge a complaint:</strong> You have the right to lodge a complaint with your local data protection supervisory authority</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. California Privacy Rights (CCPA)</h2>
              <p className="text-gray-600 mb-4">
                California residents have additional rights under the California Consumer Privacy Act:
              </p>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li><strong>Right to know:</strong> You may request information about the categories and specific pieces of personal data we have collected</li>
                <li><strong>Right to delete:</strong> You may request deletion of your personal data, subject to legal exceptions</li>
                <li><strong>Right to opt-out:</strong> We do not sell personal information. If this changes, we will provide a &quot;Do Not Sell My Information&quot; mechanism</li>
                <li><strong>Non-discrimination:</strong> We will not discriminate against you for exercising your privacy rights</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Changes to This Policy</h2>
              <p className="text-gray-600 mb-4">
                We may update this Privacy Policy from time to time. Material changes will be communicated to registered users via email at least 14 days before they take effect. The &quot;Last updated&quot; date at the top of this page indicates when the policy was last revised.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Contact Us</h2>
              <p className="text-gray-600 mb-4">
                If you have questions about this Privacy Policy, wish to exercise your data rights, or have a privacy concern, please contact us:
              </p>
              <ul className="list-none text-gray-600 mb-4 space-y-1">
                <li><strong>Privacy enquiries:</strong> <a href="mailto:privacy@pitchey.com" className="text-purple-600 hover:text-purple-500 underline">privacy@pitchey.com</a></li>
                <li><strong>General enquiries:</strong> <a href="mailto:noreply@pitchey.com" className="text-purple-600 hover:text-purple-500 underline">noreply@pitchey.com</a></li>
                <li><strong>Website:</strong> <Link to="/contact" className="text-purple-600 hover:text-purple-500 underline">Contact Page</Link></li>
              </ul>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
