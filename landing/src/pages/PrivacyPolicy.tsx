export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Effective date: April 1, 2026</p>

        <div className="prose prose-gray max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">What Canopy Does</h2>
            <p>
              Canopy is a browser extension that lets you attach notes to elements on any webpage.
              It works in local-only mode and authenticated mode. Signing in does not automatically
              enable paid cloud sync. Free signed-in accounts can still stay local-only, while Pro
              enables cloud sync through our hosted billing provider.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">Data We Collect</h2>
            <h3 className="text-lg font-medium mt-4 mb-2">Local Mode (no account)</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your notes and their content</li>
              <li>The URLs and element selectors where notes are attached</li>
              <li>Tags and folders you create</li>
            </ul>
            <p className="mt-2">
              All of this data is stored exclusively in your browser using Chrome's local
              storage API. It never leaves your device. We cannot access it.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">Authenticated Free Mode</h3>
            <p>When you sign in with Google or email, we additionally collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your email address (for account identification)</li>
              <li>Your account plan and entitlement status</li>
            </ul>
            <p className="mt-2">
              A signed-in Free account does not automatically sync notes, folders, or tags to the
              cloud. It can remain local-only until you upgrade.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">Pro Cloud Sync</h3>
            <p>When you have an active Pro entitlement, we additionally process:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your synced notes, tags, and folders in our cloud database</li>
              <li>Billing-linked customer and subscription identifiers needed to enforce access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">How We Store Your Data</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Local storage:</strong> Chrome's extension storage API, sandboxed to the
                extension and inaccessible to websites or other extensions.
              </li>
              <li>
                <strong>Cloud storage:</strong> Supabase (hosted on AWS), secured with row-level
                security policies that ensure you can only access your own data.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">Third-Party Services</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Supabase</strong> — database and authentication.{' '}
                <a href="https://supabase.com/privacy" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                  Supabase Privacy Policy
                </a>
              </li>
              <li>
                <strong>Google OAuth</strong> — sign-in only. We request your email address and
                profile name. We do not access your Google Drive, Gmail, or any other Google
                service.
              </li>
              <li>
                <strong>Polar</strong> — billing, tax handling, receipts, and subscription
                management for Pro.{' '}
                <a href="https://polar.sh/privacy" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                  Polar Privacy Policy
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">Permissions Explained</h2>
            <p>
              Canopy requests access to all websites (<code>&lt;all_urls&gt;</code>) because notes
              can be attached to any webpage. The extension needs to read page structure to
              identify elements and display note badges. It does not read, collect, or transmit
              page content beyond the CSS selectors and XPaths needed to re-attach notes to
              elements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">Data Retention and Deletion</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Local data:</strong> Deleted when you uninstall the extension or clear
                extension data in Chrome settings.
              </li>
              <li>
                <strong>Cloud data:</strong> You can delete individual notes, tags, and folders at
                any time. Billing records needed for subscription administration may also be held
                by Polar under their policies. To delete all synced data and your account, contact
                us at the email below.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">Analytics and Tracking</h2>
            <p>
              Canopy does not include any analytics, telemetry, or tracking. We do not use
              cookies. We do not sell or share your data with third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">Changes to This Policy</h2>
            <p>
              If we make material changes to this policy, we will update the effective date at the
              top and notify users through the extension or our website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">Contact</h2>
            <p>
              Questions about this policy? Email us at{' '}
              <a href="mailto:privacy@canopy.so" className="text-blue-600 underline">
                privacy@canopy.so
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
