import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-gray-500 mb-8">Last updated: February 23, 2026</p>

          <div className="prose prose-gray max-w-none space-y-8">

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-600 mb-4">
                By accessing or using Pitchey (&quot;the Platform&quot;), operated by Pitchey Ltd (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you must not access or use the Platform.
              </p>
              <p className="text-gray-600 mb-4">
                These Terms constitute a legally binding agreement between you and Pitchey. By creating an account, uploading content, or engaging in any transaction on the Platform, you confirm that you have read, understood, and agree to be bound by these Terms and our <Link to="/privacy" className="text-purple-600 hover:text-purple-500 underline">Privacy Policy</Link>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Platform Description</h2>
              <p className="text-gray-600 mb-4">
                Pitchey is a professional marketplace connecting content creators, investors, and production companies in the film, television, and media industries. The Platform provides:
              </p>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li>Pitch submission and management tools for creators</li>
                <li>Discovery, evaluation, and investment facilitation for investors</li>
                <li>Pitch review, project management, and submissions workflow for production companies</li>
                <li>Secure document handling including scripts, pitch decks, and supporting materials</li>
                <li>Non-Disclosure Agreement (NDA) management for confidential content</li>
                <li>In-platform messaging between users</li>
                <li>Credit-based access system for premium features</li>
              </ul>
              <p className="text-gray-600 mb-4">
                Pitchey is a facilitator and intermediary. We do not produce, fund, or guarantee the success of any project listed on the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. User Accounts</h2>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">3.1 Eligibility</h3>
              <p className="text-gray-600 mb-4">
                You must be at least 18 years old and have the legal capacity to enter into a binding agreement. By registering, you represent that all information you provide is truthful and accurate.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">3.2 Account Types</h3>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li><strong>Creator accounts:</strong> For individuals or entities submitting and managing creative pitches, scripts, and supporting materials</li>
                <li><strong>Investor accounts:</strong> For individuals or entities browsing, evaluating, and investing in creative projects</li>
                <li><strong>Production accounts:</strong> For production companies reviewing, shortlisting, and managing pitch submissions</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">3.3 Account Security</h3>
              <p className="text-gray-600 mb-4">
                You are solely responsible for maintaining the confidentiality of your account credentials. All passwords are securely hashed using industry-standard cryptographic methods. You must notify us immediately of any unauthorized access to your account. We are not liable for losses arising from unauthorized use of your account where you have failed to maintain adequate security.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">3.4 Account Termination</h3>
              <p className="text-gray-600 mb-4">
                We reserve the right to suspend or terminate your account at any time for violation of these Terms, fraudulent activity, or conduct that harms other users or the Platform. You may request account deletion at any time, subject to Section 10 (Data Retention).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Confidential Materials and Document Handling</h2>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">4.1 Uploaded Documents</h3>
              <p className="text-gray-600 mb-4">
                The Platform allows users to upload confidential and sensitive materials including, but not limited to, scripts, pitch decks, synopses, budgets, character breakdowns, and supporting media files. You acknowledge that:
              </p>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li>You are solely responsible for the content you upload</li>
                <li>You have all necessary rights, permissions, and licences to upload and share such materials</li>
                <li>Uploaded materials are stored securely using encrypted cloud storage infrastructure</li>
                <li>We implement reasonable technical safeguards but cannot guarantee absolute security against all possible breaches</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">4.2 Non-Disclosure Agreements (NDAs)</h3>
              <p className="text-gray-600 mb-4">
                Creators may require investors or production companies to sign an NDA before accessing detailed pitch materials. By signing an NDA on the Platform:
              </p>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li>You agree to keep all disclosed information strictly confidential</li>
                <li>You will not reproduce, distribute, or share NDA-protected materials with any third party</li>
                <li>Breach of an NDA may result in immediate account termination and legal action by the disclosing party</li>
                <li>Pitchey facilitates NDA execution but is not a party to the NDA between users unless otherwise stated</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">4.3 Document Retention</h3>
              <p className="text-gray-600 mb-4">
                Uploaded documents are retained for as long as your account is active or as needed to provide the Platform&apos;s services. Upon account deletion, we will remove your uploaded materials within 30 days, except where retention is required by law or for dispute resolution.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Intellectual Property</h2>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">5.1 Your Content</h3>
              <p className="text-gray-600 mb-4">
                You retain full ownership of all intellectual property rights in content you submit to the Platform, including pitches, scripts, synopses, and creative materials. By uploading content, you grant Pitchey a limited, non-exclusive, royalty-free licence to:
              </p>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li>Store and display your content to authorised users on the Platform</li>
                <li>Generate thumbnails, previews, and metadata for browse/search functionality</li>
                <li>Include anonymised, aggregate data derived from your content in platform analytics</li>
              </ul>
              <p className="text-gray-600 mb-4">
                This licence terminates when you delete your content or account, except to the extent required for legal compliance or backup/archival purposes.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">5.2 Platform IP</h3>
              <p className="text-gray-600 mb-4">
                The Pitchey name, logo, design, and software are our intellectual property. You may not copy, modify, or reverse-engineer any part of the Platform.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">5.3 Infringement Claims</h3>
              <p className="text-gray-600 mb-4">
                If you believe content on the Platform infringes your intellectual property rights, please contact us at <a href="mailto:legal@pitchey.com" className="text-purple-600 hover:text-purple-500 underline">legal@pitchey.com</a> with details of the alleged infringement. We will investigate and take appropriate action, including removal of infringing content.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Credits and Payments</h2>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">6.1 Credit System</h3>
              <p className="text-gray-600 mb-4">
                The Platform uses an internal credit system to manage access to certain features. Credits are required for actions such as uploading content, sending messages, and requesting NDAs. New users receive a starter allocation of free credits upon registration.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">6.2 Purchasing Credits</h3>
              <p className="text-gray-600 mb-4">
                Additional credits may be purchased through our payment processor, Stripe. All purchases are processed in the currency displayed at the time of purchase. Prices are inclusive of applicable taxes unless otherwise stated.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">6.3 Subscriptions</h3>
              <p className="text-gray-600 mb-4">
                Subscription plans provide recurring credit allocations and premium features. Subscriptions renew automatically unless cancelled before the renewal date. You may cancel at any time through your account settings; cancellation takes effect at the end of the current billing period.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-2">6.4 Refunds</h3>
              <p className="text-gray-600 mb-4">
                Credit purchases are non-refundable once credits have been used. Unused credit balances may be refunded within 14 days of purchase, subject to our refund policy. Subscription fees are non-refundable for the current billing period but you will retain access until the period ends.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Investment Disclaimer</h2>
              <p className="text-gray-600 mb-4">
                <strong>Pitchey is not a financial services provider, broker, or investment adviser.</strong> The Platform facilitates introductions between creators and potential investors but does not:
              </p>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li>Guarantee funding for any project</li>
                <li>Provide investment advice or recommendations</li>
                <li>Verify the financial viability of any project or the credentials of any investor</li>
                <li>Act as an escrow or custodian for funds</li>
                <li>Guarantee any return on investment</li>
              </ul>
              <p className="text-gray-600 mb-4">
                All investment decisions and agreements are solely between the parties involved. You should seek independent financial and legal advice before making any investment. Investing in creative projects carries significant risk, including the risk of total loss of your investment.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Prohibited Conduct</h2>
              <p className="text-gray-600 mb-4">You agree not to:</p>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li>Upload content that is defamatory, obscene, or unlawful</li>
                <li>Submit content that infringes any third party&apos;s intellectual property rights</li>
                <li>Provide false or misleading information in pitches or profiles</li>
                <li>Use the Platform to launder money or facilitate fraud</li>
                <li>Attempt to circumvent the NDA or credit systems</li>
                <li>Scrape, harvest, or systematically download content from the Platform</li>
                <li>Share NDA-protected materials outside the Platform</li>
                <li>Impersonate another user or entity</li>
                <li>Interfere with the security or functionality of the Platform</li>
                <li>Use automated bots or scripts to access the Platform</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Messaging and Communications</h2>
              <p className="text-gray-600 mb-4">
                The Platform provides in-app messaging to facilitate professional communication between users. Messages and file attachments are stored securely. You agree to use messaging only for legitimate business purposes related to pitches, investments, or production activities. Harassment, spam, or solicitation unrelated to the Platform&apos;s purpose will result in account suspension.
              </p>
              <p className="text-gray-600 mb-4">
                By using the Platform, you consent to receive transactional emails from us at <strong>noreply@pitchey.com</strong>, including account verification, password resets, NDA notifications, and investment updates.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Data Retention and Deletion</h2>
              <p className="text-gray-600 mb-4">
                We retain your personal data and uploaded content for as long as your account is active. Upon account deletion:
              </p>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li>Your profile and personal data will be anonymised or deleted within 30 days</li>
                <li>Uploaded documents will be permanently removed from our storage systems</li>
                <li>Messages you sent will show as &quot;[Deleted User]&quot; but the content of conversations with other users may be retained for their records</li>
                <li>Transaction records (credit purchases, NDA executions) may be retained for up to 7 years for legal and regulatory compliance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Limitation of Liability</h2>
              <p className="text-gray-600 mb-4">
                To the maximum extent permitted by law:
              </p>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li>The Platform is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied</li>
                <li>We are not liable for any loss or damage arising from the unauthorised disclosure of your confidential materials, except where caused by our gross negligence</li>
                <li>We are not liable for the actions, omissions, or representations of other users</li>
                <li>Our total liability to you for all claims shall not exceed the amount you paid to us in the 12 months preceding the claim</li>
                <li>We are not liable for indirect, incidental, consequential, or punitive damages</li>
              </ul>
              <p className="text-gray-600 mb-4">
                Nothing in these Terms excludes or limits liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be excluded by law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Indemnification</h2>
              <p className="text-gray-600 mb-4">
                You agree to indemnify and hold harmless Pitchey, its directors, employees, and agents from any claims, liabilities, damages, costs, or expenses (including legal fees) arising from:
              </p>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li>Your breach of these Terms</li>
                <li>Your violation of any law or third-party rights</li>
                <li>Content you upload to the Platform</li>
                <li>Your interactions with other users</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Dispute Resolution</h2>
              <p className="text-gray-600 mb-4">
                Any dispute arising from or in connection with these Terms shall first be addressed through good-faith negotiation between the parties. If a dispute cannot be resolved within 30 days, it shall be submitted to binding arbitration in accordance with the rules of the applicable jurisdiction. Each party bears its own costs unless the arbitrator rules otherwise.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Governing Law</h2>
              <p className="text-gray-600 mb-4">
                These Terms are governed by and construed in accordance with the laws of the jurisdiction in which Pitchey Ltd is registered. You agree to submit to the exclusive jurisdiction of the courts in that jurisdiction for the resolution of any disputes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">15. Modifications</h2>
              <p className="text-gray-600 mb-4">
                We reserve the right to modify these Terms at any time. Material changes will be communicated to registered users via email at least 14 days before they take effect. Continued use of the Platform after the effective date constitutes acceptance. If you do not agree with the updated Terms, you must stop using the Platform and may request account deletion.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">16. Contact</h2>
              <p className="text-gray-600 mb-4">
                For questions about these Terms of Service, please contact us:
              </p>
              <ul className="list-none text-gray-600 mb-4 space-y-1">
                <li><strong>Email:</strong> <a href="mailto:legal@pitchey.com" className="text-purple-600 hover:text-purple-500 underline">legal@pitchey.com</a></li>
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
