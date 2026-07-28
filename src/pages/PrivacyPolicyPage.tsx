import { usePageTitle } from '../hooks/usePageTitle';

export function PrivacyPolicyPage() {
  usePageTitle('Privacy Policy');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Privacy Policy</h1>
        <p className="text-gray-600 dark:text-gray-400">Last updated 2026-07-28</p>
      </header>

      <div className="space-y-6 text-gray-700 dark:text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">What this site collects</h2>
          <p>
            SportsSimulate itself does not require an account, does not run its own analytics, and does not
            collect any personal information beyond what your browser sends as part of loading the page (such as
            your IP address, which is logged by our hosting provider for standard operational purposes).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Advertising</h2>
          <p>
            This site may display ads served by Google AdSense. Google and its advertising partners use cookies
            and similar technologies to serve ads based on your prior visits to this and other websites. You can
            learn more about how Google uses this data, and control your ad settings, at{' '}
            <a
              href="https://policies.google.com/technologies/ads"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              policies.google.com/technologies/ads
            </a>
            . You can opt out of personalized advertising at{' '}
            <a
              href="https://adssettings.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              adssettings.google.com
            </a>{' '}
            or, for other participating networks, at{' '}
            <a
              href="https://www.aboutads.info/choices"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              aboutads.info/choices
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Your choices</h2>
          <p>
            If you're located in the European Economic Area, the UK, or Switzerland, you'll be shown a consent
            message before any personalized ads are served, and can decline personalization at any time through
            that message or through the Google links above.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Contact</h2>
          <p>
            Questions about this policy can be sent to{' '}
            <a
              href="mailto:info@sportssimulate.com"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              info@sportssimulate.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
